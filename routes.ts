import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchSchema, type Business } from "@shared/schema";
import { z } from "zod";
import fetch from "node-fetch";
import SerpApi from "google-search-results-nodejs";
import * as cheerio from "cheerio";

// API configuration
const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_API_BASE_URL = 'https://api.yelp.com/v3';
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;

// Function to fetch details for a single business from Yelp
async function getYelpBusinessDetails(id: string): Promise<any> {
  if (!YELP_API_KEY) {
    console.error('Yelp API key is not configured');
    return null;
  }

  try {
    // Construct the URL for Yelp business details
    const url = `${YELP_API_BASE_URL}/businesses/${id}`;
    
    // Make the API request to Yelp
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yelp API business details error: ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    // Enhanced debugging: Log important parts
    console.log(`API RESPONSE FOR ${data.name || id}:`);
    if (data.url) console.log(`- Yelp URL: ${data.url}`);
    
    // Check for website in various possible locations
    if (data.website) console.log(`- Website URL from direct property: ${data.website}`);
    if (data.url_new) console.log(`- Website URL from url_new: ${data.url_new}`);
    if (data.business_website) console.log(`- Website URL from business_website: ${data.business_website}`);
    
    // Now try to fetch the business attributes page to get the website
    try {
      console.log(`Attempting to fetch business attributes page for ${data.name}...`);
      
      // This URL pattern was provided by the user - it seems to be a page we can access
      // that might contain the business website
      const attributesUrl = `https://www.yelp.com/biz_attribute?biz_id=${id}`;
      console.log(`Trying to fetch from: ${attributesUrl}`);
      
      const attributesResponse = await fetch(attributesUrl);
      
      if (attributesResponse.ok) {
        const html = await attributesResponse.text();
        console.log(`Received attributes page HTML (${html.length} chars)`);
        
        // Extract the website URL by looking for the pattern where websites appear
        // This is a basic approach that would need refinement in a production app
        if (html.includes('Website</span>')) {
          console.log(`Found Website label in HTML`);
          
          // Try to find the URL that follows the "Website" label
          const websiteMatch = html.match(/Website<\/span>[\s\S]*?href="([^"]+)"/i);
          if (websiteMatch && websiteMatch[1]) {
            const extractedWebsite = websiteMatch[1];
            console.log(`- Found website on attributes page: ${extractedWebsite}`);
            // Add the found website to the data object
            data.website = extractedWebsite;
          } else {
            console.log(`- Website label found but couldn't extract URL`);
          }
        } else {
          console.log(`- No Website label found on attributes page`);
        }
      } else {
        console.log(`- Could not access attributes page: ${attributesResponse.status}`);
      }
    } catch (attrError) {
      console.error(`Error fetching attributes page for ${data.name}:`, attrError);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching business details from Yelp for ID ${id}:`, error);
    return null;
  }
}

// Function to fetch real business data from Yelp
async function yelpSearch(term: string, location: string): Promise<Business[]> {
  if (!YELP_API_KEY) {
    console.error('Yelp API key is not configured');
    return [];
  }

  try {
    console.log(`Performing Yelp search for: ${term} in ${location}`);
    
    // Construct the URL for Yelp API search
    const url = `${YELP_API_BASE_URL}/businesses/search`;
    const params = new URLSearchParams({
      term,
      location,
      limit: '20',
      sort_by: 'best_match',
    });
    
    // Make the API request to Yelp
    const response = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${YELP_API_KEY}`,
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yelp API error: ${response.status} ${response.statusText} - ${errorText}`);
      return [];
    }
    
    const data = await response.json() as any;
    
    if (!data.businesses || !Array.isArray(data.businesses)) {
      console.error('Invalid response from Yelp API');
      return [];
    }
    
    // Process businesses sequentially to avoid rate limiting
    const processedBusinesses = [];
    
    for (let index = 0; index < data.businesses.length; index++) {
      const business = data.businesses[index];
      
      // Extract address parts
      const address = business.location?.display_address?.join(', ') || '';
      const addressParts = business.location?.display_address || [];
      
      // Format the location information
      const city = business.location?.city || '';
      const state = business.location?.state || '';
      const zipCode = business.location?.zip_code || '';
      
      // Set highest rated flag based on rating (businesses with ratings of 4.5 or above)
      const isHighestRated = business.rating >= 4.5;
      
      // Extract categories/services
      const services = business.categories?.map((cat: any) => cat.title) || [];
      if (term && !services.includes(term) && services.length < 5) {
        services.push(term);
      }
      
      // Get detailed business info to retrieve the actual website
      // We'll set website to the business URL and then try to get the actual website if possible
      let website = null;
      let hasWebsite = false;
      let yelpUrl = business.url || null;
      
      // Initially set all businesses as not having a website
      // We'll try two approaches to find their website
      website = null;
      hasWebsite = false;
      
      // Approach 1: Try to guess the website based on business name
      // This is a fallback in case the API doesn't return a website
      const domainName = business.name.toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove special chars
        .replace(/\s+/g, '')      // Remove spaces
        .replace(/&/g, 'and');    // Replace & with and
      
      // Create a couple of possible website URLs based on business name
      const possibleWebsites = [
        `${domainName}.com`,
        `www.${domainName}.com`
      ];
      
      // Add delay between requests to avoid rate limiting
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 350)); // 350ms delay between requests
      }
      
      // Try to get business details and website for every business
      try {
        console.log(`Fetching details for ${business.name} (${business.id})...`);
        
        // First attempt: Get details from Yelp API
        const details = await getYelpBusinessDetails(business.id);
        
        if (details) {
          // Check if business has a website in their details
          if (details.website) {
            // Ensure website URL has proper formatting
            website = details.website;
            // Make sure it's not a Yelp URL
            if (!website.includes('yelp.com')) {
              hasWebsite = true;
              console.log(`Found real website for ${business.name} from Yelp: ${website}`);
            } else {
              console.log(`Found Yelp URL, not a website for ${business.name}: ${website}`);
              website = null;
              hasWebsite = false;
            }
          }
          
          // Update Yelp URL if available
          yelpUrl = business.url || details.url || null;
        }
        
        // Second attempt: If we didn't find a website from Yelp, try Google search
        if (!website) {
          console.log(`No website found from Yelp for ${business.name}, trying Google search...`);
          
          // Get the full city and state string for better search results
          const cityState = `${city}, ${state}`;
          
          // Try to find the website using Google search
          const googleFoundWebsite = await searchBusinessWebsite(business.name, cityState);
          
          if (googleFoundWebsite) {
            website = googleFoundWebsite;
            hasWebsite = true;
            console.log(`Found website from Google for ${business.name}: ${website}`);
          } else {
            // Try the alternative method if the first one fails
            const alternativeWebsite = await searchBusinessWebsiteAlternative(business.name, cityState);
            
            if (alternativeWebsite) {
              website = alternativeWebsite;
              hasWebsite = true;
              console.log(`Found website from alternative search for ${business.name}: ${website}`);
            } else {
              // If both methods fail, mark as no website
              website = null;
              hasWebsite = false;
              console.log(`No website found for ${business.name} after all attempts`);
            }
          }
        }
      } catch (detailsError) {
        console.error(`Error getting details for ${business.name}:`, detailsError);
        
        // Mark as no website if there was an error
        website = null;
        hasWebsite = false;
      }
      
      // Add the processed business to our results
      processedBusinesses.push({
        id: 20000 + index, // Using ID range that won't conflict with other source IDs
        name: business.name,
        industry: term,
        address: addressParts[0] || '',
        city,
        state,
        zipCode,
        phone: business.display_phone || '',
        email: null, // No email data from Yelp
        website, // The actual business website URL from Yelp details
        hasWebsite, // Whether the business has an actual website
        rating: business.rating?.toString() || '0',
        reviewCount: business.review_count || 0,
        description: business.categories?.map((cat: any) => cat.title).join(', ') || `${term} in ${city}`,
        services,
        isHighestRated,
        yelpUrl, // The Yelp page URL for this business
        googleUrl: null
      });
    }
    
    // Sort the businesses appropriately
    return processedBusinesses.sort((a: Business, b: Business) => {
      // First, sort businesses without websites to the top (these will be yellow)
      if (!a.hasWebsite && b.hasWebsite) return -1;
      if (a.hasWebsite && !b.hasWebsite) return 1;
      
      // Next, sort by highest rated (these will be blue)
      if (a.isHighestRated && !b.isHighestRated) return -1;
      if (!a.isHighestRated && b.isHighestRated) return 1;
      
      // Finally, sort by rating as a tiebreaker
      return parseFloat(b.rating) - parseFloat(a.rating);
    });
  } catch (error) {
    console.error('Error fetching data from Yelp:', error);
    return [];
  }
}

// Function to search for business website - now using multiple approaches
async function searchBusinessWebsite(businessName: string, cityState: string): Promise<string | null> {
  try {
    console.log(`Searching for website of "${businessName}" in ${cityState}...`);
    
    // First, try Google Maps API to get the most accurate results
    const googleMapsResult = await searchBusinessWithGoogleMaps(businessName, cityState);
    if (googleMapsResult) {
      console.log(`Found website via Google Maps API: ${googleMapsResult}`);
      return googleMapsResult;
    }
    
    // If Google Maps didn't find it, fall back to web search
    console.log(`No website found via Google Maps API, trying web search...`);
    
    // Create different variations of search queries to try
    const queries = [
      `${businessName} ${cityState} official website`,
      `${businessName} plumber ${cityState}`,
      `${businessName} contact information`,
      `${businessName} homepage`,
    ];
    
    // Try each query until we find a valid website
    for (const query of queries) {
      const website = await searchWithQuery(businessName, query);
      if (website) {
        return website;
      }
      // Wait between queries to avoid getting rate limited
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching for business website: ${error}`);
    return null;
  }
}

// Function to search for business information using Google Maps API
async function searchBusinessWithGoogleMaps(businessName: string, cityState: string): Promise<string | null> {
  if (!SERPAPI_API_KEY) {
    console.log('SerpAPI key not available, skipping Google Maps search');
    return null;
  }
  
  try {
    console.log(`Searching Google Maps for "${businessName}" in ${cityState}...`);
    
    // Extract city and state from cityState string 
    const [city, state] = cityState.split(',').map(part => part.trim());
    
    // Construct the query
    const query = `${businessName} ${city} ${state}`;
    
    // Create the URL for the SerpAPI request with Google Maps engine
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.append('engine', 'google_maps');
    url.searchParams.append('q', query);
    url.searchParams.append('type', 'search');
    url.searchParams.append('api_key', SERPAPI_API_KEY);
    
    // Make the API request
    console.log(`Making request to SerpAPI: ${url.toString().replace(SERPAPI_API_KEY, 'API_KEY_HIDDEN')}`);
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`Failed to fetch Google Maps results: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    // Save the full response for debugging
    console.log(`Received Google Maps API response with ${data.local_results?.length || 0} local results`);
    
    // Check if we have local results
    if (data.local_results && data.local_results.length > 0) {
      // Calculate similarity score between business names
      const calculateNameSimilarity = (name1: string, name2: string): number => {
        name1 = name1.toLowerCase().trim();
        name2 = name2.toLowerCase().trim();
        
        // Exact match gets highest score
        if (name1 === name2) return 100;
        
        // Check if one contains the other
        if (name1.includes(name2)) return 80;
        if (name2.includes(name1)) return 80;
        
        // Split into words and count matching words
        const words1 = name1.split(/\s+/);
        const words2 = name2.split(/\s+/);
        
        let matchCount = 0;
        for (const word1 of words1) {
          if (word1.length < 3) continue; // Skip short words
          for (const word2 of words2) {
            if (word2.length < 3) continue;
            if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
              matchCount++;
              break;
            }
          }
        }
        
        // Calculate percentage match based on words
        const totalWords = Math.max(1, words1.length);
        return Math.min(75, (matchCount / totalWords) * 100);
      };
      
      // Score each result and sort by score
      const scoredResults = data.local_results.map((result: any) => {
        const nameScore = calculateNameSimilarity(result.title || '', businessName);
        
        // Add location accuracy score
        let locationScore = 0;
        const address = result.address || '';
        if (address.toLowerCase().includes(city.toLowerCase())) {
          locationScore += 15;
        }
        if (address.toLowerCase().includes(state.toLowerCase())) {
          locationScore += 10;
        }
        
        // Total score
        const totalScore = nameScore + locationScore;
        
        return {
          result,
          score: totalScore,
          name: result.title,
          address: result.address
        };
      });
      
      // Sort by score descending
      scoredResults.sort((a, b) => b.score - a.score);
      
      // Log top results for debugging
      console.log(`Top 3 Google Maps matches:`);
      scoredResults.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index+1}. ${item.name} (Score: ${item.score.toFixed(1)}) @ ${item.address}`);
      });
      
      // Use the highest scoring result
      const bestMatch = scoredResults[0];
      
      if (bestMatch.score < 30) {
        console.log(`Best match score too low (${bestMatch.score.toFixed(1)}), might not be the right business`);
      } else {
        console.log(`Using best match: ${bestMatch.name} (Score: ${bestMatch.score.toFixed(1)})`);
        
        const result = bestMatch.result;
        
        // Extract phone number if available
        if (result.phone) {
          console.log(`Phone number: ${result.phone}`);
        }
        
        // Extract hours if available
        if (result.operating_hours) {
          console.log(`Hours: ${JSON.stringify(result.operating_hours)}`);
        }
        
        // Extract website if available
        if (result.website) {
          console.log(`Found website for ${result.title}: ${result.website}`);
          return result.website;
        }
      }
    } else {
      console.log(`No local results found in Google Maps for ${businessName}`);
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching Google Maps: ${error}`);
    return null;
  }
}

// Enhanced search function using JavaScript
async function searchWithQuery(businessName: string, query: string): Promise<string | null> {
  try {
    console.log(`Searching with query: "${query}"`);
    
    // Format the search query
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encodedQuery}`;
    
    // Make the request with a randomized browser-like user agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
    ];
    
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch search results: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Parse the HTML using cheerio
    const $ = cheerio.load(html);
    
    // Store potential matches with a relevance score
    interface WebsiteCandidate {
      url: string;
      score: number;
      title: string;
    }
    
    const candidates: WebsiteCandidate[] = [];
    
    // Extract all links and analyze them
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;
      
      // Extract the URL from Google's redirect format
      let url = href;
      if (href.startsWith('/url?') || href.includes('/url?q=')) {
        const match = href.match(/[?&]q=([^&]+)/);
        if (match && match[1]) {
          url = decodeURIComponent(match[1]);
        }
      }
      
      // Skip if not a valid URL
      if (!url.startsWith('http')) return;
      
      // Skip non-business websites
      if (url.includes('google.com') ||
          url.includes('facebook.com') || 
          url.includes('instagram.com') || 
          url.includes('twitter.com') ||
          url.includes('linkedin.com') ||
          url.includes('youtube.com') ||
          url.includes('yelp.com') ||
          url.includes('yellowpages.com') ||
          url.includes('tripadvisor.com') ||
          url.includes('bbb.org') ||
          url.includes('mapquest.com') ||
          url.includes('manta.com') ||
          url.includes('merchantcircle.com') ||
          url.includes('angi.com') ||
          url.includes('thumbtack.com') ||
          url.includes('angieslist.com') ||
          url.includes('houzz.com') ||
          url.includes('google.com') ||
          url.includes('wikipedia.org') ||
          url.includes('bing.com') ||
          url.includes('yahoo.com') ||
          url.includes('homeadvisor.com') ||
          url.includes('superpages.com') ||
          url.includes('dexknows.com') ||
          url.includes('whitepages.com') ||
          url.includes('411.com')) {
        return;
      }
      
      // Get the text of the link and its surrounding context
      const linkText = $(element).text().toLowerCase();
      const title = $(element).closest('div').text().toLowerCase() || '';
      const parentText = $(element).parent().text().toLowerCase() || '';
      
      // Calculate a relevance score
      let score = 0;
      const businessNameLower = businessName.toLowerCase();
      const businessNameWords = businessNameLower.split(/\s+/).filter(word => word.length > 2);
      
      // Scoring based on URL structure
      if (url.toLowerCase().includes(businessNameLower.replace(/\s+/g, ''))) {
        score += 10;
      }
      
      if (url.toLowerCase().includes(businessNameLower.replace(/\s+/g, '-'))) {
        score += 10;
      }
      
      // Domain scoring
      const domain = url.split('/')[2] || '';
      if (domain.includes(businessNameLower.replace(/\s+/g, ''))) {
        score += 15;
      }
      
      // Scoring based on link text containing the business name
      if (linkText.includes(businessNameLower)) {
        score += 10;
      }
      
      // Bonus for title/headline containing the business name
      if (title.includes(businessNameLower)) {
        score += 8;
      }
      
      // Bonus for parent text containing the business name
      if (parentText.includes(businessNameLower)) {
        score += 5;
      }
      
      // Scoring for partial matches of business name words
      businessNameWords.forEach(word => {
        if (linkText.includes(word)) {
          score += 2;
        }
        if (url.toLowerCase().includes(word)) {
          score += 3;
        }
      });
      
      // Bonus for .com domain with business name
      if (domain.endsWith('.com') && businessNameWords.some(word => domain.includes(word))) {
        score += 5;
      }
      
      // Bonus for containing "plumbing" in the domain (for plumbers)
      if (domain.includes('plumb')) {
        score += 3;
      }
      
      // Bonus for sites that look like business sites
      if (url.includes('/contact') || 
          url.includes('/about') || 
          url.includes('/services')) {
        score += 2;
      }
      
      // Only consider URLs with a decent score
      if (score >= 5) {
        candidates.push({ 
          url, 
          score,
          title: linkText || title || parentText
        });
      }
    });
    
    // Sort candidates by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    
    // Return the highest-scoring website URL if available
    if (candidates.length > 0) {
      console.log(`Found ${candidates.length} potential websites. Best match: ${candidates[0].url} (score: ${candidates[0].score})`);
      console.log(`  Title: ${candidates[0].title}`);
      
      // Extra validation for the URL
      try {
        const urlObj = new URL(candidates[0].url);
        // Make sure it has a valid hostname
        if (urlObj.hostname && urlObj.hostname.includes('.')) {
          return candidates[0].url;
        }
      } catch (e) {
        console.log(`Invalid URL format: ${candidates[0].url}`);
      }
      
      // If the top result is invalid, try the next one
      if (candidates.length > 1) {
        return candidates[1].url;
      }
    }
    
    console.log(`No suitable website found with query: ${query}`);
    return null;
  } catch (error) {
    console.error(`Error in website search: ${error}`);
    return null;
  }
}

// Alternative implementation using direct HTTP requests instead of SerpApi
// This is a fallback in case SerpApi is not available
async function searchBusinessWebsiteAlternative(businessName: string, cityState: string): Promise<string | null> {
  try {
    console.log(`Using custom search method for ${businessName} website...`);
    
    // Format the search query (different variants to try)
    const queries = [
      `${businessName} ${cityState} official website`,
      `${businessName} ${cityState} plumbing company website`,
      `${businessName} contact ${cityState}`
    ];
    
    // Try each query in sequence
    for (const queryText of queries) {
      const query = encodeURIComponent(queryText);
      const url = `https://www.google.com/search?q=${query}`;
      
      // Make the request with a browser-like user agent
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch search results: ${response.status} ${response.statusText}`);
        continue; // Try the next query
      }
      
      const html = await response.text();
      
      // Parse the HTML using cheerio
      const $ = cheerio.load(html);
      
      // Track potential matches by relevance score
      interface PotentialMatch {
        url: string;
        score: number;
      }
      
      const potentialMatches: PotentialMatch[] = [];
      
      // Look for all links in the search results
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Extract actual URL from Google's redirect URL format
        let url = href;
        if (href.startsWith('/url?')) {
          const match = href.match(/[?&]q=([^&]+)/);
          if (match && match[1]) {
            url = decodeURIComponent(match[1]);
          }
        }
        
        // Filter out non-http URLs and known non-business sites
        if (!url.startsWith('http')) return;
        
        // Skip social media, review sites, directories, etc.
        if (url.includes('facebook.com') || 
            url.includes('instagram.com') || 
            url.includes('twitter.com') ||
            url.includes('linkedin.com') ||
            url.includes('youtube.com') ||
            url.includes('yelp.com') ||
            url.includes('yellowpages.com') ||
            url.includes('tripadvisor.com') ||
            url.includes('bbb.org') ||
            url.includes('mapquest.com') ||
            url.includes('manta.com') ||
            url.includes('merchantcircle.com') ||
            url.includes('angi.com') ||
            url.includes('thumbtack.com') ||
            url.includes('angieslist.com') ||
            url.includes('houzz.com') ||
            url.includes('google.com/maps') ||
            url.includes('google.com/search')) {
          return;
        }
        
        // Get the text content of the link and its parent element
        const linkText = $(element).text().toLowerCase();
        const parentText = $(element).parent().text().toLowerCase();
        
        // Calculate a relevance score
        let score = 0;
        const businessNameLower = businessName.toLowerCase();
        const businessNameParts = businessNameLower.split(/\s+/);
        
        // Exact match is best
        if (linkText.includes(businessNameLower)) {
          score += 10;
        }
        
        // Parent contains business name
        if (parentText.includes(businessNameLower)) {
          score += 5;
        }
        
        // Contains parts of the business name
        businessNameParts.forEach(part => {
          if (part.length > 2 && linkText.includes(part)) {
            score += 2;
          }
        });
        
        // Bonus for .com domains
        if (url.includes('.com')) {
          score += 2;
        }
        
        // Bonus for short URLs (likely main domain)
        const urlParts = url.split('/');
        if (urlParts.length <= 4) {
          score += 3;
        }
        
        // Bonus if URL contains business name
        if (url.toLowerCase().includes(businessNameLower.replace(/\s+/g, '')) || 
            url.toLowerCase().includes(businessNameLower.replace(/\s+/g, '-'))) {
          score += 5;
        }
        
        // Only consider URLs with a minimum score
        if (score >= 3) {
          potentialMatches.push({ url, score });
        }
      });
      
      // Sort by score descending
      potentialMatches.sort((a, b) => b.score - a.score);
      
      // Return the highest scored match if available
      if (potentialMatches.length > 0) {
        console.log(`Found business website: ${potentialMatches[0].url} (score: ${potentialMatches[0].score})`);
        return potentialMatches[0].url;
      }
      
      // Wait a bit before trying the next query to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`No business website found for ${businessName} after multiple attempts`);
    return null;
  } catch (error) {
    console.error(`Error in business website search: ${error}`);
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API route for searching businesses
  app.get("/api/search", async (req, res) => {
    try {
      // Parse and validate search parameters
      const parsedParams = searchSchema.parse({
        industry: req.query.industry || undefined,
        location: req.query.location || undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 9,
        sort: req.query.sort || "relevance",
        filter: req.query.filter || "all"
      });

      // Get businesses matching search criteria from our database
      const result = await storage.getBusinessesBySearch(parsedParams);
      let businesses = result.businesses;
      let total = result.total;

      // Only proceed with API fetching if we have both industry and location
      if (parsedParams.industry && parsedParams.location) {
        // Get real data from Yelp API
        let yelpResults: Business[] = [];
        try {
          console.log('Fetching results from Yelp API...');
          yelpResults = await yelpSearch(parsedParams.industry, parsedParams.location);
          
          // Add a source indicator to Yelp results
          yelpResults.forEach(business => {
            business.description = `${business.description} (via Yelp)`;
          });
          
          console.log(`Received ${yelpResults.length} results from Yelp API`);
          
          // Replace any existing results with the real Yelp data
          businesses = yelpResults;
          total = businesses.length;
        } catch (error) {
          console.error('Failed to fetch from Yelp API:', error);
        }
      }

      // Handle pagination if needed
      let paginatedBusinesses = businesses;
      if (businesses.length > parsedParams.limit) {
        const startIndex = (parsedParams.page - 1) * parsedParams.limit;
        const endIndex = startIndex + parsedParams.limit;
        paginatedBusinesses = businesses.slice(startIndex, endIndex);
      }

      // Return results with pagination metadata
      res.json({
        businesses: paginatedBusinesses,
        pagination: {
          total: total,
          page: parsedParams.page,
          limit: parsedParams.limit,
          totalPages: Math.ceil(total / parsedParams.limit)
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid search parameters", errors: error.errors });
      } else {
        console.error('Search error:', error);
        res.status(500).json({ message: "Error searching businesses" });
      }
    }
  });

  // API route for autocomplete industries
  app.get("/api/autocomplete/industries", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const industries = await storage.searchIndustries(query);
      res.json({ industries });
    } catch (error) {
      res.status(500).json({ message: "Error fetching industries" });
    }
  });

  // API route for autocomplete locations
  app.get("/api/autocomplete/locations", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const locations = await storage.searchLocations(query);
      res.json({ locations });
    } catch (error) {
      res.status(500).json({ message: "Error fetching locations" });
    }
  });

  // API route for getting a business by ID
  app.get("/api/businesses/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const business = await storage.getBusinessById(id);
      
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      // Get business tags
      const tags = await storage.getBusinessTags(id);
      
      res.json({ 
        business,
        tags: tags.map(tag => tag.tag) 
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching business" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}


import { searchGoogleMaps } from "./serpapi";
import express from "express";

const mapsRouter = express.Router();

mapsRouter.get("/api/search/maps", async (req, res) => {
  const { query, lat, lng } = req.query;
  const apiKey = process.env.SERPAPI_KEY;

  if (!query || !lat || !lng) {
    return res.status(400).json({ error: "Missing query or location" });
  }

  try {
    const results = await searchGoogleMaps(query as string, parseFloat(lat as string), parseFloat(lng as string), apiKey!);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "SerpAPI error", details: err });
  }
});

export default mapsRouter;


import { searchGoogleRaw } from "./customSearch";

// Manual fallback route for Google scraping
router.get("/api/search/manual", async (req, res) => {
  const { name, city } = req.query;

  if (!name || !city) {
    return res.status(400).json({ error: "Missing business name or city" });
  }

  try {
    const results = await searchGoogleRaw(name as string, city as string);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Manual Google search failed", details: err });
  }
});


import { fetchGoogleRating } from "./customSearch";

router.get("/api/reviews", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing URL" });
  }

  try {
    const result = await fetchGoogleRating(url);
    if (result) return res.json(result);
    return res.status(404).json({ error: "Could not fetch review data" });
  } catch (err) {
    return res.status(500).json({ error: "Scraping error", details: err });
  }
});
