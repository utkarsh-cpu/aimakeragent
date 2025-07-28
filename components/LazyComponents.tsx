import { lazy, Suspense } from 'react';
import { Skeleton } from './ui/skeleton';

// Lazy load non-critical components
export const LazySettingsPanel = lazy(() => 
  import('./SettingsPanel').then(module => ({ default: module.SettingsPanel }))
);

export const LazyKeyboardShortcutsHelp = lazy(() => 
  import('./KeyboardShortcutsHelp').then(module => ({ default: module.KeyboardShortcutsHelp }))
);

export const LazyVoiceInput = lazy(() => 
  import('./VoiceInput').then(module => ({ default: module.VoiceInput }))
);

export const LazyAccessibilitySettings = lazy(() => 
  import('./AccessibilitySettings').then(module => ({ default: module.AccessibilitySettings }))
);

export const LazyConversationSearch = lazy(() => 
  import('./ConversationSearch').then(module => ({ default: module.ConversationSearch }))
);

export const LazyMessageSearch = lazy(() => 
  import('./MessageSearch').then(module => ({ default: module.MessageSearch }))
);

export const LazyMarkdownPreview = lazy(() => 
  import('./MarkdownPreview').then(module => ({ default: module.MarkdownPreview }))
);

export const LazyFileUpload = lazy(() => 
  import('./FileUpload').then(module => ({ default: module.FileUpload }))
);

export const LazyAttachmentManager = lazy(() => 
  import('./AttachmentManager').then(module => ({ default: module.AttachmentManager }))
);

// Loading fallback components
export const SettingsPanelSkeleton = () => (
  <div className="w-80 h-full bg-background border-l">
    <div className="p-4 border-b">
      <Skeleton className="h-6 w-20 mb-2" />
      <Skeleton className="h-4 w-32" />
    </div>
    <div className="p-4 space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  </div>
);

export const KeyboardHelpSkeleton = () => (
  <div className="max-w-2xl mx-auto p-6">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  </div>
);

export const VoiceInputSkeleton = () => (
  <div className="flex items-center space-x-2">
    <Skeleton className="h-8 w-8 rounded-full" />
    <Skeleton className="h-4 w-24" />
  </div>
);

export const SearchSkeleton = () => (
  <div className="p-4 space-y-3">
    <Skeleton className="h-8 w-full" />
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
);

// Wrapper components with suspense
export const SettingsPanelWithSuspense = (props: any) => (
  <Suspense fallback={<SettingsPanelSkeleton />}>
    <LazySettingsPanel {...props} />
  </Suspense>
);

export const KeyboardShortcutsHelpWithSuspense = (props: any) => (
  <Suspense fallback={<KeyboardHelpSkeleton />}>
    <LazyKeyboardShortcutsHelp {...props} />
  </Suspense>
);

export const VoiceInputWithSuspense = (props: any) => (
  <Suspense fallback={<VoiceInputSkeleton />}>
    <LazyVoiceInput {...props} />
  </Suspense>
);

export const AccessibilitySettingsWithSuspense = (props: any) => (
  <Suspense fallback={<SearchSkeleton />}>
    <LazyAccessibilitySettings {...props} />
  </Suspense>
);

export const ConversationSearchWithSuspense = (props: any) => (
  <Suspense fallback={<SearchSkeleton />}>
    <LazyConversationSearch {...props} />
  </Suspense>
);

export const MessageSearchWithSuspense = (props: any) => (
  <Suspense fallback={<SearchSkeleton />}>
    <LazyMessageSearch {...props} />
  </Suspense>
);

export const MarkdownPreviewWithSuspense = (props: any) => (
  <Suspense fallback={<Skeleton className="h-32 w-full" />}>
    <LazyMarkdownPreview {...props} />
  </Suspense>
);

export const FileUploadWithSuspense = (props: any) => (
  <Suspense fallback={<Skeleton className="h-20 w-full border-2 border-dashed" />}>
    <LazyFileUpload {...props} />
  </Suspense>
);

export const AttachmentManagerWithSuspense = (props: any) => (
  <Suspense fallback={<Skeleton className="h-16 w-full" />}>
    <LazyAttachmentManager {...props} />
  </Suspense>
);