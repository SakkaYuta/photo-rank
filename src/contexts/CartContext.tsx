import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CartItem = {
  id: string
  title: string
  price: number
  imageUrl?: string | null
  qty: number
  factoryId?: string | null
  factoryProductId?: string | null
  workId?: string | null
  variant?: { size?: string; color?: string } | null
  constraints?: { minOrder: number; maxOrder?: number } | null
}

type CartContextType = {
  items: CartItem[]
  addToCart: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  updateQty: (id: string, qty: number) => void
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  updateQty: () => {},
})

const STORAGE_KEY = 'cart.v1'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items])

  const addToCart = (item: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems(prev => {
      const ex = prev.find(p => p.id === item.id)
      if (ex) return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + qty } : p)
      return [...prev, { ...item, qty }]
    })
  }
  const removeFromCart = (id: string) => setItems(prev => prev.filter(p => p.id !== id))
  const clearCart = () => setItems([])
  const updateQty = (id: string, qty: number) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, qty: Math.max(1, qty) } : p))
  }

  const value = useMemo(() => ({ items, addToCart, removeFromCart, clearCart, updateQty }), [items])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
