import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@flashread/backend/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RsvpDemo } from '@/components/rsvp-demo';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users to the app
  if (user) {
    redirect('/app');
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">FlashRead</span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/boncui/FlashRead"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>Star on GitHub</span>
            </a>
            <Link href="/login">
              <Button size="sm" className="font-medium">
                Get Started
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section with Gradient Background */}
        <section className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-purple-950/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/20" />
          
          {/* Decorative Elements */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 dark:bg-blue-800/10 rounded-full blur-3xl animate-pulse-subtle" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-200/30 dark:bg-purple-800/10 rounded-full blur-3xl animate-pulse-subtle" />
          
          <div className="relative container mx-auto px-4 py-16 md:py-24 lg:py-32">
            <div className="flex flex-col items-center text-center space-y-8">
              {/* Badge */}
              <div className="animate-fade-up opacity-0" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Open Source Reading Tool
                </span>
              </div>

              {/* Headline */}
              <div className="space-y-4 max-w-4xl animate-fade-up opacity-0" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  Research papers are{' '}
                  <span className="relative">
                    <span className="relative z-10">hard to read.</span>
                    <span className="absolute bottom-2 left-0 w-full h-3 bg-yellow-300/50 dark:bg-yellow-500/30 -rotate-1" />
                  </span>
                </h1>
                <p className="text-lg text-muted-foreground md:text-xl lg:text-2xl max-w-2xl mx-auto leading-relaxed">
                  FlashRead reformats dense academic text into clearer, less fatiguing layouts using research-backed typography and speed reading techniques.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 animate-fade-up opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                <Link href="/login">
                  <Button size="lg" className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                    Start Reading Free
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-2"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Button>
                </Link>
                <a href="#demo">
                  <Button size="lg" variant="outline" className="text-base px-8 h-12">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="mr-2"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Try Demo
                  </Button>
                </a>
              </div>

              {/* Video Section */}
              <div className="w-full max-w-4xl animate-fade-up opacity-0" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity" />
                  <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl border bg-black">
                    <iframe
                      className="w-full h-full"
                      src="https://www.youtube.com/embed/NdKcDPBQ-Lw"
                      title="FlashRead Demo"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">2-3x</div>
                <div className="text-sm text-muted-foreground mt-1">Faster Reading</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground mt-1">Open Source</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">PDF</div>
                <div className="text-sm text-muted-foreground mt-1">OCR Support</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">Free</div>
                <div className="text-sm text-muted-foreground mt-1">Forever</div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Interactive Demo
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Experience RSVP Speed Reading
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Try our Rapid Serial Visual Presentation reader right here. 
              Paste your own text or use the sample to see how it works.
            </p>
          </div>
          <div className="w-full max-w-2xl mx-auto">
            <RsvpDemo />
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/30">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mb-4">
                Features
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Built for serious readers
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Powered by research in speech science, cadence modeling, and mathematical algorithms 
                to optimize how text is presented and paced.
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 7V4h16v3" />
                      <path d="M9 20h6" />
                      <path d="M12 4v16" />
                    </svg>
                  </div>
                  <CardTitle>Typography Optimization</CardTitle>
                  <CardDescription>
                    Research-backed text formatting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Automatic heading detection, optimal line lengths, and comfortable
                    spacing reduce eye strain and improve comprehension.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="white"
                      stroke="white"
                      strokeWidth="0"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <CardTitle>RSVP Speed Reading</CardTitle>
                  <CardDescription>
                    Read faster with focused word presentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Rapid Serial Visual Presentation displays words one at a time,
                    eliminating eye movement and boosting reading speed.
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M10 13l-2 2 2 2" />
                      <path d="M14 17l2-2-2-2" />
                    </svg>
                  </div>
                  <CardTitle>Document OCR</CardTitle>
                  <CardDescription>
                    Extract text from PDFs and images
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Upload scanned papers or screenshots. Our OCR pipeline extracts
                    clean, readable text ready for FlashRead formatting.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 mb-4">
              How It Works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three simple steps
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-lg mb-2">Upload Your Document</h3>
              <p className="text-muted-foreground text-sm">
                Drop a PDF, paste text, or let our OCR extract content from scanned pages.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-lg mb-2">Choose Your Mode</h3>
              <p className="text-muted-foreground text-sm">
                Select typography mode for comfortable reading or RSVP for speed reading.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-lg mb-2">Start Reading</h3>
              <p className="text-muted-foreground text-sm">
                Enjoy optimized text that reduces eye strain and improves focus.
              </p>
            </div>
          </div>
        </section>

        {/* Contribute Section */}
        <section className="border-t">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl mx-auto">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-purple-500/10 border p-8 md:p-12">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-primary">Open Source Project</span>
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-bold mb-4">
                    Help us make reading better
                  </h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    FlashRead is a work in progress and we&apos;d love your help. 
                    Whether it&apos;s improving cadence algorithms, accessibility features, 
                    or entirely new ideas—every contribution matters.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://github.com/boncui/FlashRead"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="w-full sm:w-auto">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="mr-2"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        View on GitHub
                      </Button>
                    </a>
                    <a
                      href="https://www.linkedin.com/in/boncui/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" className="w-full sm:w-auto">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="mr-2"
                        >
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                        Connect on LinkedIn
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary-foreground"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
              <span className="font-semibold">FlashRead</span>
            </div>
            
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/boncui/FlashRead"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/in/boncui/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>Built with Next.js, Supabase, and Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
