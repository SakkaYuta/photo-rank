import React, { useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Loader2 } from 'lucide-react'
import { releaseWorkLock } from '../../services/payment.service'

const pk = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = pk ? loadStripe(pk) : null

type Props = {
  clientSecret: string
  workId: string
  onSuccess?: () => void
  onSucceeded?: (paymentIntentId: string) => void
  onError?: (msg: string) => void
  onCancel?: () => void
}

function CheckoutForm({ clientSecret, workId, onSuccess, onSucceeded, onError, onCancel }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}`,
        },
        redirect: 'if_required',
      })
      if (error) {
        const msg = error.message || '決済処理中にエラーが発生しました'
        setErrorMessage(msg)
        onError?.(msg)
        try { await releaseWorkLock(workId) } catch {}
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess?.()
        if (paymentIntent.id) {
          onSucceeded?.(paymentIntent.id)
        }
      }
    } catch (err: any) {
      const msg = err?.message || '予期しないエラーが発生しました'
      setErrorMessage(msg)
      onError?.(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{errorMessage}</div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!stripe || isProcessing} className="btn btn-primary flex-1">
          {isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />処理中...</>) : '購入する'}
        </button>
        <button type="button" onClick={onCancel} disabled={isProcessing} className="btn btn-outline">キャンセル</button>
      </div>
    </form>
  )
}

export function StripeCheckout(props: Props) {
  const options: StripeElementsOptions = {
    clientSecret: props.clientSecret,
    appearance: { theme: 'stripe' },
  }
  if (!stripePromise) {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        Stripeの公開鍵が未設定です。`.env` に `VITE_STRIPE_PUBLISHABLE_KEY` を設定してください。
      </div>
    )
  }
  return <Elements stripe={stripePromise} options={options}><CheckoutForm {...props} /></Elements>
}
