import type { Metadata } from 'next'
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material'
import Link from 'next/link'
import Image from 'next/image'
import ThemeClientProvider from '@/components/ThemeProvider'
import styles from './layout.module.css'
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
              <Box className={styles.navContainer}>
                <Link href="/" className={styles.logoLink}>
                  <Box className={styles.logoContainer}>
                    <Image 
                      src="/logo.png" 
                      alt="eFootball Tournament Manager" 
                      width={40} 
                      height={40}
                      className={styles.logoImage}
                    />
                  </Box>
                </Link>
              </Box>
              <Button color="inherit" component={Link} href="/" className={styles.navButton}>Home</Button>
              <Button color="inherit" component={Link} href="/admin">Admin</Button>
            </Toolbar>
          </AppBar>
          <Container className={styles.mainContainer}>
            {children}
          </Container>
        </ThemeClientProvider>
      </body>
    </html>
  )
}
