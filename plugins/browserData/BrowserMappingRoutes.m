#import <React/RCTBridgeModule.h>
#import <WebKit/WebKit.h>
#import <Network/Network.h>

@interface BrowserMappingRoutes : NSObject <RCTBridgeModule>
@end

@implementation BrowserMappingRoutes
static __weak BrowserMappingRoutes *activeOwner;
RCT_EXPORT_MODULE(BrowserMappingRoutes)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }
- (NSDictionary *)constantsToExport {
  if (@available(iOS 17.0, *)) return @{@"supported": @YES};
  return @{@"supported": @NO};
}
- (void)invalidate {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (@available(iOS 17.0, *)) {
      if (activeOwner == self) {
        WKWebsiteDataStore.defaultDataStore.proxyConfigurations = @[];
        activeOwner = nil;
      }
    }
  });
}

RCT_REMAP_METHOD(configure, configurePort:(NSInteger)port routes:(NSArray<NSDictionary *> *)routes
                 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (@available(iOS 17.0, *)) {
    WKWebsiteDataStore *store = WKWebsiteDataStore.defaultDataStore;
    if (!routes.count) {
      if (activeOwner == self) { store.proxyConfigurations = @[]; activeOwner = nil; }
      resolve(nil); return;
    }
    if (port < 1 || port > UINT16_MAX) { reject(@"browser-mappings", @"Invalid proxy port", nil); return; }
    NSString *service = [@(port) stringValue];
    nw_endpoint_t endpoint = nw_endpoint_create_host("127.0.0.1", service.UTF8String);
    nw_proxy_config_t proxy = nw_proxy_config_create_socksv5(endpoint);
    for (NSDictionary *route in routes) {
      nw_proxy_config_add_match_domain(proxy, [route[@"domain"] UTF8String]);
    }
    store.proxyConfigurations = @[proxy];
    activeOwner = self;
    resolve(nil);
  } else if (!routes.count) { resolve(nil); }
  else { reject(@"unsupported", @"WebView update required", nil); }
}
@end
