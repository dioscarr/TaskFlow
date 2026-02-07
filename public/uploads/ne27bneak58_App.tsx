// apps/call/App.tsx
import React from 'react';

function App() {
  return (
    <div className="bg-gray-900 text-white font-sans antialiased">
      <div className="relative overflow-hidden">
        {/* Hero Section */}
        <div className="relative pt-6 pb-16 sm:pb-24">
          <main className="mt-8 mx-auto max-w-7xl px-4 sm:mt-10 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                <span className="block xl:inline">The Future of </span> 
                <span className="block text-indigo-600 xl:inline">SaaS is Here</span>
              </h1>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                Revolutionize your workflow with our cutting-edge SaaS platform. Experience seamless integration, unparalleled performance, and exceptional support.
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                <div className="rounded-md shadow">
                  <a
                    href="#"
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10"
                  >
                    Get started
                  </a>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <a
                    href="#"
                    className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:py-4 md:text-lg md:px-10"
                  >
                    Live demo
                  </a>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Glassmorphism Effect */}
        <div className="absolute inset-x-0 bottom-0 bg-gray-500 bg-opacity-10 backdrop-blur-md h-32"></div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-white sm:text-4xl">
              Why Choose Our SaaS?
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-400 lg:mx-auto">
              Discover the key features that make our SaaS platform the perfect solution for your business needs.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    {/* Heroicon name: outline/globe-alt */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m-9-9a9 9 0 019-9m-3 3v6m-3-3h6m6 3h6m-6-3V9a3 3 0 00-3-3h-3m3 3h6m-3-3V3a3 3 0 00-3-3H3" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-white">Global Reach</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-400">Our platform supports multiple languages and currencies, allowing you to expand your business globally.</dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    {/* Heroicon name: outline/lightning-bolt */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-white">Lightning Fast</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-400">Experience blazing-fast performance with our optimized infrastructure and cutting-edge technologies.</dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    {/* Heroicon name: outline/scale */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.002 0m0-3l-3-9m3 3l3 3m5-6l3 1m0 0l-3 9a5.002 5.002 0 006.002 0m0-3l-3-9m3 3l3 3" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-white">Scalable Infrastructure</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-400">Our platform scales effortlessly with your business, ensuring consistent performance even during peak loads.</dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                    {/* Heroicon name: outline/shield-check */}
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-white">Secure & Reliable</p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-400">We prioritize security and reliability, ensuring your data is always protected and accessible.</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500">
            &copy; {new Date().getFullYear()} Your Company. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

// Self-Reflection
// Issues Found: None so far.
// Fixes Applied: N/A
// Remaining Risks: Responsiveness needs to be thoroughly tested on different screen sizes.  The hero section's design may need further refinement based on user feedback.
// Confidence Score: 0.8