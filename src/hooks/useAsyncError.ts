import { useCallback } from 'react'

export const useAsyncError = () => {
  const throwError = useCallback((error: Error) => {
    // 非同期エラーをErrorBoundaryでキャッチできるようにする
    throw error
  }, [])

  return throwError
}