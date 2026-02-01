/**
 * SEO Configuration
 * Centralized SEO defaults for the application
 */

export interface SEOConfig {
    title: string;
    description: string;
    keywords?: string[];
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    twitterSite?: string;
    canonicalUrl?: string;
}

export const defaultSEO: SEOConfig = {
    title: 'Your App Name',
    description: 'A premium web application built with modern web technologies. Experience fast, beautiful, and responsive design.',
    keywords: ['react', 'vite', 'web app', 'premium', 'modern'],
    ogImage: '/og-image.jpg', // Add your Open Graph image
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterSite: '@yourhandle', // Add your Twitter handle
};

/**
 * Generate page-specific SEO
 */
export function generatePageSEO(overrides: Partial<SEOConfig>): SEOConfig {
    return {
        ...defaultSEO,
        ...overrides,
    };
}

/**
 * Example usage:
 * 
 * import { generatePageSEO } from './lib/seo-config';
 * 
 * const pageSEO = generatePageSEO({
 *   title: 'About Us - Your App Name',
 *   description: 'Learn more about our mission and team',
 * });
 */
