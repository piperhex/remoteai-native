#import <React/RCTBridgeModule.h>
#import <WebKit/WebKit.h>
#import <CommonCrypto/CommonKeyDerivation.h>

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
  NSMutableSet<NSString *> *types = [NSMutableSet set];
  if (cookies) {
    [types addObjectsFromArray:@[WKWebsiteDataTypeCookies, WKWebsiteDataTypeLocalStorage,
      WKWebsiteDataTypeSessionStorage, WKWebsiteDataTypeIndexedDBDatabases, WKWebsiteDataTypeWebSQLDatabases]];
  }
  if (cache) [types addObjectsFromArray:@[WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache,
    WKWebsiteDataTypeOfflineWebApplicationCache]];
  [[WKWebsiteDataStore defaultDataStore] removeDataOfTypes:types modifiedSince:[NSDate distantPast]
    completionHandler:^{ resolve(nil); }];
}
@end
