// Global type definition for LIFF
declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>
      isInClient?: () => boolean
      isLoggedIn: () => boolean
      login: (options?: { scope?: string[]; prompt?: string; redirectUri?: string }) => void
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>
      getFriendship?: () => Promise<{ friendFlag: boolean }>
      closeWindow?: () => void
    }
  }
}

export {}


