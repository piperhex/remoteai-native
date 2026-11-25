#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface BrowserMouse : NSObject <RCTBridgeModule>
@property (nonatomic, strong) NSMapTable<UIView *, UIView *> *presses;
@property (nonatomic, strong) NSMapTable<UIView *, NSMutableSet<NSString *> *> *buttons;
@property (nonatomic, copy) NSString *pageScript;
@end

@implementation BrowserMouse
RCT_EXPORT_MODULE(BrowserMouse)
@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;
+ (BOOL)requiresMainQueueSetup { return NO; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (instancetype)init {
  if ((self = [super init])) {
    _presses = [NSMapTable weakToWeakObjectsMapTable];
    _buttons = [NSMapTable weakToStrongObjectsMapTable];
    NSURL *url = [NSBundle.mainBundle URLForResource:@"BrowserPageMouse" withExtension:@"js"];
    _pageScript = [NSString stringWithContentsOfURL:url encoding:NSUTF8StringEncoding error:nil];
  }
  return self;
}

- (void)sendToPage:(WKWebView *)web point:(CGPoint)point event:(NSDictionary *)event {
  if (!self.pageScript.length || CGRectIsEmpty(web.bounds)) return;
  NSMutableDictionary *input = [event mutableCopy];
  input[@"x"] = @(point.x / MAX(1, web.bounds.size.width - 1));
  input[@"y"] = @(point.y / MAX(1, web.bounds.size.height - 1));
  NSString *script = [NSString stringWithFormat:
    @"if (!globalThis.pageMouse) { %@; globalThis.pageMouse = BrowserPageMouse.send; } return globalThis.pageMouse(input);",
    self.pageScript];
  [web callAsyncJavaScript:script arguments:@{@"input": input} inFrame:nil
            inContentWorld:WKContentWorld.defaultClientWorld completionHandler:^(id value, NSError *error) {
    if (!error && [event[@"kind"] isEqual:@"wheel"] && [value isEqual:@NO]) [self scroll:web.scrollView event:event];
  }];
}

- (void)scroll:(UIScrollView *)scroll event:(NSDictionary *)event {
  CGPoint offset = scroll.contentOffset;
  CGFloat delta = [event[@"delta"] doubleValue];
  UIEdgeInsets inset = scroll.adjustedContentInset;
  if ([event[@"horizontal"] boolValue]) {
    CGFloat maxX = scroll.contentSize.width - scroll.bounds.size.width + inset.right;
    offset.x = MAX(-inset.left, MIN(maxX, offset.x + delta));
  } else {
    CGFloat maxY = scroll.contentSize.height - scroll.bounds.size.height + inset.bottom;
    offset.y = MAX(-inset.top, MIN(maxY, offset.y - delta));
  }
  [scroll setContentOffset:offset animated:NO];
}

RCT_EXPORT_METHOD(send:(nonnull NSNumber *)tag input:(NSDictionary *)event) {
  UIView *root = [_viewRegistry_DEPRECATED viewForReactTag:tag];
  if (!root) return;
  CGPoint point = CGPointMake([event[@"x"] doubleValue] * MAX(0, root.bounds.size.width - 1),
                              [event[@"y"] doubleValue] * MAX(0, root.bounds.size.height - 1));
  UIView *hit = [root hitTest:point withEvent:nil];
  UIView *previous = [self.presses objectForKey:root];
  NSString *kind = event[@"kind"];
  BOOL button = [kind isEqual:@"button"];
  BOOL down = button && [event[@"down"] boolValue];
  NSMutableSet *buttons = [self.buttons objectForKey:root];
  if (down && (previous || hit)) {
    if (!buttons) { buttons = [NSMutableSet set]; [self.buttons setObject:buttons forKey:root]; }
    [buttons addObject:event[@"button"]]; [self.presses setObject:previous ?: hit forKey:root];
  } else if (button) {
    if (![buttons containsObject:event[@"button"]]) return;
    [buttons removeObject:event[@"button"]];
  }
  if ([kind isEqual:@"cancel"] || !buttons.count) {
    [self.presses removeObjectForKey:root]; [self.buttons removeObjectForKey:root];
  }
  UIView *view = previous ?: hit;
  UIScrollView *scroll = nil;
  for (UIView *node = view; node && node != root.superview; node = node.superview) {
    if ([node isKindOfClass:WKWebView.class]) {
      [self sendToPage:(WKWebView *)node point:[root convertPoint:point toView:node] event:event]; return;
    }
    if (!scroll && [node isKindOfClass:UIScrollView.class]) scroll = (UIScrollView *)node;
  }
  if (scroll && [kind isEqual:@"wheel"]) [self scroll:scroll event:event];
  if (button && !down && hit == previous && [event[@"button"] isEqual:@"left"]) {
    for (UIView *node = hit; node && node != root.superview; node = node.superview)
      if (node.isAccessibilityElement && [node accessibilityActivate]) break;
  }
}
@end
