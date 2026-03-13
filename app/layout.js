export const metadata = {
  title: 'خليل الحلواني',
  description: 'خليل الحلواني',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, padding: 0 }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
} 