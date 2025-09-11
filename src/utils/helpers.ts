export const formatJPY = (value: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)

export const cls = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

