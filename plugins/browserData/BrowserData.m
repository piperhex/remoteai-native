#import <React/RCTBridgeModule.h>
#import <WebKit/WebKit.h>
#import <CommonCrypto/CommonCrypto.h>

@interface BrowserData : NSObject <RCTBridgeModule>
@end

@implementation BrowserData
RCT_EXPORT_MODULE(BrowserData)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

RCT_REMAP_METHOD(derive, derivePassphrase:(NSString *)passphrase salt:(NSString *)salt
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (!passphrase.length || passphrase.length > 1024 || salt.length != 32 ||
      [salt rangeOfCharacterFromSet:[[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"]
        invertedSet]].location != NSNotFound) {
    reject(@"vault-invalid", @"Invalid vault input", nil); return;
  }
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    unsigned char saltBytes[16], key[32];
    for (NSUInteger index = 0; index < 16; index++) {
      unsigned int value = 0;
      [[NSScanner scannerWithString:[salt substringWithRange:NSMakeRange(index * 2, 2)]] scanHexInt:&value];
      saltBytes[index] = value;
    }
    NSData *password = [passphrase dataUsingEncoding:NSUTF8StringEncoding];
    int result = CCKeyDerivationPBKDF(kCCPBKDF2, password.bytes, password.length, saltBytes, 16,
      kCCPRFHmacAlgSHA256, 600000, key, 32);
    NSMutableString *hex = [NSMutableString stringWithCapacity:64];
    if (result == kCCSuccess) for (NSUInteger index = 0; index < 32; index++) [hex appendFormat:@"%02x", key[index]];
    memset_s(key, sizeof(key), 0, sizeof(key));
    if (result == kCCSuccess) resolve(hex); else reject(@"vault-unavailable", @"Vault unavailable", nil);
  });
}

RCT_REMAP_METHOD(clear, clearCookies:(BOOL)cookies cache:(BOOL)cache
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSSet<NSString *> *networkCaches = [NSSet setWithArray:@[WKWebsiteDataTypeDiskCache,
    WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeOfflineWebApplicationCache]];
  NSMutableSet<NSString *> *types = cookies ? [WKWebsiteDataStore.allWebsiteDataTypes mutableCopy] : [NSMutableSet set];
  if (cache) [types unionSet:networkCaches]; else [types minusSet:networkCaches];
  if (!types.count) { resolve(nil); return; }
  if (@available(iOS 17.0, *)) {
    [WKWebsiteDataStore fetchAllDataStoreIdentifiers:^(NSArray<NSUUID *> *identifiers) {
      NSMutableArray<WKWebsiteDataStore *> *stores =
        [NSMutableArray arrayWithObject:WKWebsiteDataStore.defaultDataStore];
      for (NSUUID *identifier in identifiers) [stores addObject:[WKWebsiteDataStore dataStoreForIdentifier:identifier]];
      [self clearStores:stores types:types cookies:cookies resolve:resolve];
    }];
  } else {
    [self clearStores:@[WKWebsiteDataStore.defaultDataStore] types:types cookies:cookies resolve:resolve];
  }
}

- (void)clearStores:(NSArray<WKWebsiteDataStore *> *)stores types:(NSSet<NSString *> *)types
            cookies:(BOOL)cookies resolve:(RCTPromiseResolveBlock)resolve {
  dispatch_group_t group = dispatch_group_create();
  for (WKWebsiteDataStore *store in stores) {
    dispatch_group_enter(group);
    [store removeDataOfTypes:types modifiedSince:NSDate.distantPast completionHandler:^{
      dispatch_group_leave(group);
    }];
  }
  dispatch_group_notify(group, dispatch_get_main_queue(), ^{
    // The WebView cookie bridge can otherwise restore the deleted cookies on the next mount.
    if (cookies) [NSHTTPCookieStorage.sharedHTTPCookieStorage removeCookiesSinceDate:NSDate.distantPast];
    resolve(nil);
  });
}
@end
