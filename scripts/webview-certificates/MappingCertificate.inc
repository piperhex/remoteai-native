- (WKWebsiteDataStore *)mappingWebsiteDataStore {
  if (!_mappingCertificatePolicy.length) return nil;
  NSData *encoded = [_mappingCertificatePolicy dataUsingEncoding:NSUTF8StringEncoding];
  NSArray *policy = [NSJSONSerialization JSONObjectWithData:encoded options:0 error:nil];
  if (![policy isKindOfClass:NSArray.class] || policy.count != 3 || ![policy[1] length]) return nil;
  if (@available(iOS 17.0, macOS 14.0, *)) {
    unsigned char bytes[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(encoded.bytes, (CC_LONG)encoded.length, bytes);
    NSUUID *identifier = [[NSUUID alloc] initWithUUIDBytes:bytes];
    WKWebsiteDataStore *store = [WKWebsiteDataStore dataStoreForIdentifier:identifier];
    store.proxyConfigurations = WKWebsiteDataStore.defaultDataStore.proxyConfigurations;
    return store;
  }
  return WKWebsiteDataStore.nonPersistentDataStore;
}

// The WebKit challenge identifies the TLS peer. The main-frame URL restricts this approval to its mapped origin.
- (BOOL)handleMappingTrust:(NSURLAuthenticationChallenge *)challenge
                completion:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completion {
  if (!_mappingCertificatePolicy.length || !_mappingMainURL) return NO;
  NSURLProtectionSpace *peer = challenge.protectionSpace;
  SecTrustRef trust = peer.serverTrust;
  if (!trust || ![peer.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) return NO;
  NSData *encoded = [_mappingCertificatePolicy dataUsingEncoding:NSUTF8StringEncoding];
  NSArray *policy = [NSJSONSerialization JSONObjectWithData:encoded options:0 error:nil];
  if (![policy isKindOfClass:NSArray.class] || policy.count != 3) return NO;
  NSURL *origin = [NSURL URLWithString:policy[0]];
  NSInteger port = origin.port ? origin.port.integerValue : 443;
  if (![origin.scheme isEqual:@"https"] || ![_mappingMainURL.scheme isEqual:@"https"] ||
      ![peer.host.lowercaseString isEqual:origin.host.lowercaseString] ||
      ![_mappingMainURL.host.lowercaseString isEqual:origin.host.lowercaseString] ||
      port != peer.port || port != (_mappingMainURL.port ? _mappingMainURL.port.integerValue : 443)) return NO;
  CFErrorRef failure = NULL;
  if (SecTrustEvaluateWithError(trust, &failure)) return NO;
  NSError *reason = CFBridgingRelease(failure);
  SecTrustResultType result;
  if (SecTrustGetTrustResult(trust, &result) != errSecSuccess || result != kSecTrustResultRecoverableTrustFailure) return NO;
  if (![reason.domain isEqualToString:NSOSStatusErrorDomain] ||
      (reason.code != errSecHostNameMismatch && reason.code != errSecNotTrusted &&
       reason.code != errSecCreateChainFailed && reason.code != errSecCertificateExpired &&
       reason.code != errSecCertificateNotValidYet)) return NO;
  SecCertificateRef leaf = SecTrustGetCertificateAtIndex(trust, 0);
  if (!leaf) return NO;
  NSData *der = CFBridgingRelease(SecCertificateCopyData(leaf));
  unsigned char bytes[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(der.bytes, (CC_LONG)der.length, bytes);
  NSMutableString *fingerprint = [NSMutableString stringWithCapacity:64];
  for (NSUInteger i = 0; i < sizeof(bytes); i++) [fingerprint appendFormat:@"%02X", bytes[i]];
  if ([fingerprint isEqualToString:policy[1]]) {
    completion(NSURLSessionAuthChallengeUseCredential, [NSURLCredential credentialForTrust:trust]);
    return YES;
  }
  // WebKit reports provisional navigation failures only for the main document. Subresource failures stay local.
  _mappingFailedPin = fingerprint;
  completion(NSURLSessionAuthChallengePerformDefaultHandling, nil);
  return YES;
}
