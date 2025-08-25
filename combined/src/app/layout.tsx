import type { Metadata } from 'next'
import { AppBar, Toolbar, Typography, Button, Container } from '@mui/material'
import Link from 'next/link'
import ThemeClientProvider from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'eFootball Tournament Manager',
  description: 'Tournament management system for eFootball',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto+Condensed:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeClientProvider>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" sx={{ flex: 1 }}>eFootball</Typography>
              <Button color="inherit" component={Link} href="/" sx={{ mr: 2 }}>Home</Button>
              <Button color="inherit" component={Link} href="/admin">Admin</Button>
            </Toolbar>
          </AppBar>
          <Container sx={{ mt: 3 }}>
            {children}
          </Container>
        </ThemeClientProvider>
      </body>
    </html>
  )
}
