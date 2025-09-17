import { useState, useEffect } from 'react'
import { getFactoryQuotes, createManufacturingOrder } from '@/services/factory.service'
import type { FactoryQuote } from '@/services/factory.service'
import { supabase } from '@/lib/supabase'

/**
 * 工場見積もり取得のカスタムフック
 */
export const useFactoryQuotes = (
  productType: string,
  quantity: number,
  requiredDate?: Date
) => {
  const [quotes, setQuotes] = useState<FactoryQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<FactoryQuote | null>(null)

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!productType || quantity <= 0) {
        setQuotes([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const data = await getFactoryQuotes(productType, quantity, requiredDate)
        if ((data || []).length === 0) {
          setQuotes([])
          setSelectedQuote(null)
          setError('該当する製造パートナーが見つかりませんでした')
        } else {
          setQuotes(data)
          setSelectedQuote(data[0])
        }
      } catch (err: any) {
        const message = err?.message || '見積もり取得に失敗しました'
        setError(message)
        console.error('Failed to fetch quotes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQuotes()
  }, [productType, quantity, requiredDate])

  const refetch = async () => {
    setLoading(true)
    try {
      const data = await getFactoryQuotes(productType, quantity, requiredDate)
      setQuotes(data)
    } catch (err: any) {
      setError(err?.message || '見積もり取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return {
    quotes,
    loading,
    error,
    selectedQuote,
    setSelectedQuote,
    refetch,
  }
}

/**
 * 製造発注処理のカスタムフック
 */
export const useManufacturingOrder = () => {
  const [processing, setProcessing] = useState(false)
  const [orderResult, setOrderResult] = useState<any>(null)

  const placeOrder = async (
    orderId: string,
    quote: FactoryQuote,
    quantity: number,
    workId: string,
    options?: { maxPrice?: number; notes?: string }
  ) => {
    setProcessing(true)
    try {
      if (options?.maxPrice && quote.unitPrice > options.maxPrice) {
        throw new Error(`価格が上限（¥${options.maxPrice}）を超えています`)
      }

      // 作品の存在確認（数量在庫はスキーマ未定のためidのみ確認）
      const { data: work, error } = await supabase
        .from('works')
        .select('id')
        .eq('id', workId)
        .single()
      if (error || !work) throw new Error('作品が見つかりません')

      // 製造発注作成（Edge Function 経由）
      const result = await createManufacturingOrder(orderId, quote, quantity, workId, {
        maxPrice: options?.maxPrice ?? Math.round(quote.unitPrice),
        deadlineDays: undefined,
      })

      if (result.ok && result.data) {
        setOrderResult(result.data)
        return result.data
      }
      throw new Error(result.error || '発注処理に失敗しました')
    } catch (err) {
      console.error('Order placement failed:', err)
      throw err
    } finally {
      setProcessing(false)
    }
  }

  return { placeOrder, processing, orderResult }
}

