#import <React/RCTView.h>
#import <React/RCTViewManager.h>

static BOOL HasEditableTextResponder(UIView *view)
{
  if (view.isFirstResponder && [view isKindOfClass:UITextView.class]) {
    UITextView *input = (UITextView *)view;
    return input.isEditable && input.markedTextRange == nil;
  }
  for (UIView *child in view.subviews) {
    if (HasEditableTextResponder(child)) return YES;
  }
  return NO;
}

@interface ComposerShortcutView : RCTView
@property (nonatomic, copy) RCTDirectEventBlock onSendShortcut;
@end

@implementation ComposerShortcutView

- (NSArray<UIKeyCommand *> *)keyCommands
{
  UIKeyCommand *send = [UIKeyCommand keyCommandWithInput:@"\r"
                                           modifierFlags:UIKeyModifierControl
                                                  action:@selector(sendFromKeyboard:)];
  if (@available(iOS 15.0, *)) send.wantsPriorityOverSystemBehavior = YES;
  return @[send];
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender
{
  if (action == @selector(sendFromKeyboard:)) return self.onSendShortcut && HasEditableTextResponder(self);
  return [super canPerformAction:action withSender:sender];
}

- (void)sendFromKeyboard:(UIKeyCommand *)command
{
  if (self.onSendShortcut && HasEditableTextResponder(self)) self.onSendShortcut(@{});
}

@end

@interface ComposerShortcutManager : RCTViewManager
@end

@implementation ComposerShortcutManager
RCT_EXPORT_MODULE(ComposerShortcut)
RCT_EXPORT_VIEW_PROPERTY(onSendShortcut, RCTDirectEventBlock)

- (UIView *)view
{
  return [ComposerShortcutView new];
}
@end
