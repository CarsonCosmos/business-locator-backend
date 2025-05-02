import { 
  businesses, 
  businessTags, 
  type Business, 
  type InsertBusiness, 
  type BusinessTag, 
  type InsertBusinessTag,
  type SearchParams
} from "@shared/schema";

export interface IStorage {
  getAllBusinesses(): Promise<Business[]>;
  getBusinessById(id: number): Promise<Business | undefined>;
  createBusiness(business: InsertBusiness): Promise<Business>;
  addBusinessTag(tag: InsertBusinessTag): Promise<BusinessTag>;
  getBusinessesBySearch(params: SearchParams): Promise<{
    businesses: Business[];
    total: number;
  }>;
  getBusinessTags(businessId: number): Promise<BusinessTag[]>;
  searchIndustries(query: string): Promise<string[]>;
  searchLocations(query: string): Promise<{city: string, state: string}[]>;
}

export class MemStorage implements IStorage {
  private businesses: Map<number, Business>;
  private businessTags: Map<number, BusinessTag[]>;
  private businessId: number;
  private businessTagId: number;
  private industries: Set<string>;
  private locations: Set<string>;

  constructor() {
    this.businesses = new Map();
    this.businessTags = new Map();
    this.businessId = 1;
    this.businessTagId = 1;
    this.industries = new Set();
    this.locations = new Set();

    // Populate with sample data
    this.seedData();
  }

  async getAllBusinesses(): Promise<Business[]> {
    return Array.from(this.businesses.values());
  }

  async getBusinessById(id: number): Promise<Business | undefined> {
    return this.businesses.get(id);
  }

  async createBusiness(business: InsertBusiness): Promise<Business> {
    const id = this.businessId++;
    // Make sure all required properties are set with defaults if needed
    const newBusiness: Business = { 
      ...business, 
      id,
      rating: business.rating || "0",
      reviewCount: business.reviewCount || 0,
      isHighestRated: business.isHighestRated || false,
      description: business.description || null,
      services: business.services || [],
      googleUrl: business.googleUrl || null,
      yelpUrl: business.yelpUrl || null,
      hasWebsite: business.hasWebsite || false
    };
    this.businesses.set(id, newBusiness);
    this.industries.add(business.industry);
    this.locations.add(`${business.city}, ${business.state}`);
    return newBusiness;
  }

  async addBusinessTag(tag: InsertBusinessTag): Promise<BusinessTag> {
    const id = this.businessTagId++;
    const newTag: BusinessTag = { ...tag, id };
    
    if (!this.businessTags.has(tag.businessId)) {
      this.businessTags.set(tag.businessId, []);
    }
    
    const tags = this.businessTags.get(tag.businessId)!;
    tags.push(newTag);
    
    return newTag;
  }

  async getBusinessTags(businessId: number): Promise<BusinessTag[]> {
    return this.businessTags.get(businessId) || [];
  }

  async getBusinessesBySearch(params: SearchParams): Promise<{
    businesses: Business[];
    total: number;
  }> {
    let filteredBusinesses = Array.from(this.businesses.values());
    
    // Filter by industry
    if (params.industry) {
      filteredBusinesses = filteredBusinesses.filter(business => 
        business.industry.toLowerCase().includes(params.industry!.toLowerCase())
      );
    }
    
    // Filter by location (city, state)
    if (params.location) {
      filteredBusinesses = filteredBusinesses.filter(business => {
        const location = `${business.city}, ${business.state}`.toLowerCase();
        return location.includes(params.location!.toLowerCase());
      });
    }
    
    // Apply filter
    if (params.filter === 'no-website') {
      filteredBusinesses = filteredBusinesses.filter(business => !business.hasWebsite);
    } else if (params.filter === 'highest-rated') {
      filteredBusinesses = filteredBusinesses.filter(business => business.isHighestRated);
    }
    
    // Apply sorting
    switch(params.sort) {
      case 'rating-high':
        filteredBusinesses.sort((a, b) => Number(b.rating) - Number(a.rating));
        break;
      case 'rating-low':
        filteredBusinesses.sort((a, b) => Number(a.rating) - Number(b.rating));
        break;
      case 'name-asc':
        filteredBusinesses.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        filteredBusinesses.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'relevance':
      default:
        // Custom relevance sorting: no website first, then highest rated, then others
        filteredBusinesses.sort((a, b) => {
          if (!a.hasWebsite && b.hasWebsite) return -1;
          if (a.hasWebsite && !b.hasWebsite) return 1;
          if (a.isHighestRated && !b.isHighestRated) return -1;
          if (!a.isHighestRated && b.isHighestRated) return 1;
          return Number(b.rating) - Number(a.rating);
        });
    }
    
    const total = filteredBusinesses.length;
    
    // Apply pagination
    const start = (params.page - 1) * params.limit;
    const end = start + params.limit;
    filteredBusinesses = filteredBusinesses.slice(start, end);
    
    return {
      businesses: filteredBusinesses,
      total
    };
  }

  async searchIndustries(query: string): Promise<string[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.industries)
      .filter(industry => industry.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  }

  async searchLocations(query: string): Promise<{city: string, state: string}[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.locations)
      .filter(location => location.toLowerCase().includes(lowerQuery))
      .map(location => {
        const [city, state] = location.split(', ');
        return { city, state };
      })
      .slice(0, 10);
  }

  private seedData() {
    // Seed with sample business data to demonstrate functionality
    const sampleBusinesses: InsertBusiness[] = [
      {
        name: "Johnson's Plumbing Services",
        industry: "Plumbing",
        address: "432 Main St",
        city: "Boise",
        state: "ID",
        zipCode: "83702",
        phone: "(208) 555-1234",
        email: "contact@johnsonsplumbing.com",
        website: null,
        hasWebsite: false,
        rating: "3.5",
        reviewCount: 17,
        description: "Professional plumbing services for residential and commercial properties",
        services: ["Emergency Repairs", "Leak Detection", "Pipe Installation", "Sump Pump Installation", "Drain Cleaning"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/johnsons-plumbing-services-boise",
        googleUrl: "https://www.google.com/search?q=johnsons+plumbing+services+boise"
      },
      {
        name: "Ace Plumbing Solutions",
        industry: "Plumbing",
        address: "789 Oak Ave",
        city: "Boise",
        state: "ID",
        zipCode: "83706",
        phone: "(208) 555-8765",
        email: "info@aceplumbing.com",
        website: "www.aceplumbing.com",
        hasWebsite: true,
        rating: "5.0",
        reviewCount: 42,
        description: "Top-rated plumbing solutions for all your needs",
        services: ["Water Heater Installation", "Bathroom Remodeling", "Commercial Plumbing", "Tankless Water Heaters", "Repiping", "Water Line Installation"],
        isHighestRated: true,
        yelpUrl: "https://www.yelp.com/biz/ace-plumbing-solutions-boise",
        googleUrl: "https://www.google.com/search?q=ace+plumbing+solutions+boise"
      },
      {
        name: "Downtown Plumbing Co.",
        industry: "Plumbing",
        address: "221 Pine St",
        city: "Boise",
        state: "ID",
        zipCode: "83705",
        phone: "(208) 555-3456",
        email: "service@downtownplumbing.com",
        website: "www.downtownplumbing.com",
        hasWebsite: true,
        rating: "4.0",
        reviewCount: 28,
        description: "Reliable plumbing services in downtown Boise",
        services: ["Drain Cleaning", "Sewer Line Repair", "Fixture Installation", "Backflow Prevention", "Water Softener Installation", "Root Removal"],
        isHighestRated: false,
        googleUrl: "https://www.google.com/search?q=downtown+plumbing+co+boise"
      },
      {
        name: "Sam's Plumbing & Repair",
        industry: "Plumbing",
        address: "875 Maple Dr",
        city: "Boise",
        state: "ID",
        zipCode: "83709",
        phone: "(208) 555-9876",
        email: "samsplumbing@email.com",
        website: null,
        hasWebsite: false,
        rating: "4.0",
        reviewCount: 12,
        description: "Family-owned plumbing repair services",
        services: ["Leak Repair", "Drain Cleaning", "Water Heater Service", "Toilet Repair", "Faucet Installation", "Gas Line Service"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/sams-plumbing-and-repair-boise",
        googleUrl: "https://www.google.com/search?q=sams+plumbing+repair+boise"
      },
      {
        name: "City Plumbing & Heating",
        industry: "Plumbing",
        address: "332 Elm St",
        city: "Boise",
        state: "ID",
        zipCode: "83712",
        phone: "(208) 555-6543",
        email: "support@cityplumbingheating.com",
        website: "www.cityplumbingheating.com",
        hasWebsite: true,
        rating: "3.0",
        reviewCount: 9,
        description: "Combined plumbing and heating services",
        services: ["HVAC Repair", "Plumbing Emergencies", "Heating Installation", "AC Installation", "Furnace Repair", "Boiler Service"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/city-plumbing-and-heating-boise",
        googleUrl: "https://www.google.com/search?q=city+plumbing+heating+boise"
      },
      {
        name: "Elite Plumbing Pros",
        industry: "Plumbing",
        address: "999 River Rd",
        city: "Boise",
        state: "ID",
        zipCode: "83703",
        phone: "(208) 555-7890",
        email: "hello@eliteplumbingpros.com",
        website: "www.eliteplumbingpros.com",
        hasWebsite: true,
        rating: "4.7",
        reviewCount: 35,
        description: "Premium plumbing solutions for discerning customers",
        services: ["Bathroom Remodeling", "Kitchen Plumbing", "Water Filtration", "Luxury Fixtures", "Custom Shower Systems", "Smart Home Plumbing"],
        isHighestRated: true,
        yelpUrl: "https://www.yelp.com/biz/elite-plumbing-pros-boise"
      },
      {
        name: "Smith Electric",
        industry: "Electrical",
        address: "123 Volt St",
        city: "Boise",
        state: "ID",
        zipCode: "83704",
        phone: "(208) 555-2345",
        email: "info@smithelectric.com",
        website: "www.smithelectric.com",
        hasWebsite: true,
        rating: "4.5",
        reviewCount: 32,
        description: "Expert electrical services for residential and commercial properties",
        services: ["Electrical Repairs", "Wiring", "Lighting Installation", "Panel Upgrades", "Circuit Installation", "Emergency Services", "Generator Installation"],
        isHighestRated: true,
        yelpUrl: "https://www.yelp.com/biz/smith-electric-boise",
        googleUrl: "https://www.google.com/search?q=smith+electric+boise"
      },
      {
        name: "Green Thumb Landscaping",
        industry: "Landscaping",
        address: "456 Garden Ave",
        city: "Boise",
        state: "ID",
        zipCode: "83705",
        phone: "(208) 555-4567",
        email: "contact@greenthumb.com",
        website: null,
        hasWebsite: false,
        rating: "4.2",
        reviewCount: 19,
        description: "Professional landscaping and lawn care services",
        services: ["Lawn Maintenance", "Garden Design", "Irrigation Systems", "Hardscaping", "Patio Installation", "Tree Trimming", "Mulching", "Seasonal Cleanups"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/green-thumb-landscaping-boise",
        googleUrl: "https://www.google.com/search?q=green+thumb+landscaping+boise"
      },
      {
        name: "Quick Fix Plumbing",
        industry: "Plumbing",
        address: "777 Fix Rd",
        city: "Meridian",
        state: "ID",
        zipCode: "83642",
        phone: "(208) 555-3333",
        email: "quickfix@plumbing.com",
        website: null,
        hasWebsite: false,
        rating: "3.8",
        reviewCount: 14,
        description: "Fast and reliable plumbing repairs",
        services: ["Emergency Repairs", "Leak Detection", "Drain Cleaning", "Clogged Toilets", "Pipe Leaks", "24/7 Service"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/quick-fix-plumbing-meridian",
        googleUrl: "https://www.google.com/search?q=quick+fix+plumbing+meridian+idaho"
      },
      {
        name: "Sparkle Electric",
        industry: "Electrical",
        address: "888 Spark Ave",
        city: "Nampa",
        state: "ID",
        zipCode: "83651",
        phone: "(208) 555-9999",
        email: "sparkle@electric.com",
        website: "www.sparkleelectric.com",
        hasWebsite: true,
        rating: "4.8",
        reviewCount: 26,
        description: "Illuminating your spaces with expert electrical services",
        services: ["Panel Upgrades", "Smart Home Installation", "Commercial Wiring", "EV Charger Installation", "Lighting Design", "Security Lighting", "Fan Installation"],
        isHighestRated: true,
        yelpUrl: "https://www.yelp.com/biz/sparkle-electric-nampa",
        googleUrl: "https://www.google.com/search?q=sparkle+electric+nampa+idaho"
      },
      {
        name: "Mountain View Plumbing",
        industry: "Plumbing",
        address: "555 Vista Dr",
        city: "Eagle",
        state: "ID",
        zipCode: "83616",
        phone: "(208) 555-1111",
        email: "service@mountainviewplumbing.com",
        website: "www.mountainviewplumbing.com",
        hasWebsite: true,
        rating: "4.3",
        reviewCount: 31,
        description: "Serving Eagle and surrounding areas with quality plumbing services",
        services: ["Water Heater Installation", "Pipe Repair", "Fixture Replacement", "Sump Pump Repair", "Garbage Disposal Installation", "Well System Service", "Drain Camera Inspection"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/mountain-view-plumbing-eagle",
        googleUrl: "https://www.google.com/search?q=mountain+view+plumbing+eagle+idaho"
      },
      {
        name: "Bob's Hardware & Plumbing",
        industry: "Plumbing",
        address: "234 Tool St",
        city: "Caldwell",
        state: "ID",
        zipCode: "83605",
        phone: "(208) 555-2222",
        email: "bob@hardwareplumbing.com",
        website: null,
        hasWebsite: false,
        rating: "3.9",
        reviewCount: 8,
        description: "Your one-stop shop for hardware and plumbing needs",
        services: ["DIY Supplies", "Basic Plumbing", "Tool Rental", "Pipe Cutting", "Small Repairs", "Plumbing Consultations", "Hardware Sales"],
        isHighestRated: false,
        yelpUrl: "https://www.yelp.com/biz/bobs-hardware-and-plumbing-caldwell",
        googleUrl: "https://www.google.com/search?q=bobs+hardware+plumbing+caldwell+idaho"
      }
    ];

    // Create businesses
    for (const business of sampleBusinesses) {
      const newBusiness = this.createBusiness(business);
      // Add industry and location to sets for autocomplete
      this.industries.add(business.industry);
      this.locations.add(`${business.city}, ${business.state}`);

      // Simulate adding tags
      if (business.services) {
        for (const service of business.services) {
          this.addBusinessTag({
            businessId: this.businessId - 1, // The id of the just created business
            tag: service
          });
        }
      }
    }

    // Add additional industries for autocomplete
    const additionalIndustries = [
      // Home Services
      "HVAC", "Roofing", "Carpentry", "Flooring", "Painting", "Insulation", "Moving",
      "Cleaning", "Pest Control", "Pool Services", "Fencing", "Glass Repair",
      "Locksmith", "Security Systems", "Smart Home Installation", "Junk Removal",
      "Appliance Repair", "Garage Door Services", "Handyman", "Home Inspection",
      "Interior Design", "Kitchen Remodeling", "Bathroom Remodeling", "Basement Remodeling",
      "Deck & Patio", "Tree Services", "Lawn Care", "Gutter Cleaning", "House Cleaning",
      "Carpet Cleaning", "Pressure Washing", "Window Cleaning", "Chimney Sweeping",
      "Waterproofing", "Mold Remediation", "Drywall Installation",
      
      // Professional Services
      "Legal Services", "Accounting", "Financial Planning", "Tax Preparation", "Insurance",
      "Real Estate", "Mortgages", "Property Management", "Business Consulting",
      "Marketing", "Advertising", "Web Design", "Graphic Design", "Translation",
      "Notary Services", "Architecture", "Engineering", "Surveying",
      
      // Health & Wellness
      "Healthcare", "Dental", "Chiropractic", "Physical Therapy", "Massage Therapy",
      "Mental Health", "Nutrition", "Fitness", "Yoga", "Pilates", "Personal Training",
      "Weight Loss", "Acupuncture", "Alternative Medicine", "Counseling", "Therapy",
      
      // Automotive
      "Automotive Repair", "Auto Body", "Auto Detailing", "Oil Change", "Tire Shop",
      "Transmission Repair", "Brake Service", "Auto Glass", "Car Wash", "Auto Parts",
      "Towing", "Roadside Assistance", "Auto Upholstery", "Auto Electronics",
      
      // Restaurants & Food
      "Restaurants", "Cafes", "Bakeries", "Catering", "Food Trucks", "Meal Delivery",
      "Grocery Delivery", "Butcher Shops", "Specialty Foods", "Breweries", "Wineries",
      
      // Personal Services
      "Hair Salon", "Barber Shop", "Nail Salon", "Spa", "Beauty Services",
      "Tattoo", "Piercing", "Tailoring", "Dry Cleaning", "Shoe Repair",
      "Pet Services", "Pet Grooming", "Pet Training", "Veterinary Services",
      "Child Care", "Tutoring", "Elderly Care", "Home Health Care",
      
      // Entertainment & Events
      "Photography", "Videography", "DJ Services", "Event Planning", "Wedding Planning",
      "Party Rentals", "Venues", "Catering", "Musicians", "Entertainment",
      
      // Tech Services
      "Computer Repair", "IT Support", "Data Recovery", "Electronics Repair",
      "Cell Phone Repair", "Software Development", "App Development",
      "Network Installation", "Audio/Visual Installation", "Security Camera Installation",
      
      // General Retail
      "Retail", "Furniture", "Appliances", "Electronics", "Clothing", "Shoes",
      "Jewelry", "Gifts", "Books", "Toys", "Sporting Goods", "Art Supplies"
    ];
    
    for (const industry of additionalIndustries) {
      this.industries.add(industry);
    }

    // Add additional locations for autocomplete
    const additionalLocations = [
      // West Coast
      "Seattle, WA", "Spokane, WA", "Tacoma, WA", "Vancouver, WA", 
      "Portland, OR", "Eugene, OR", "Salem, OR", "Bend, OR",
      "San Francisco, CA", "Los Angeles, CA", "San Diego, CA", "Sacramento, CA", "San Jose, CA", "Oakland, CA", "Fresno, CA", "Long Beach, CA",
      
      // Mountain West
      "Denver, CO", "Colorado Springs, CO", "Aurora, CO", "Fort Collins, CO",
      "Salt Lake City, UT", "West Valley City, UT", "Provo, UT", "Ogden, UT",
      "Albuquerque, NM", "Las Cruces, NM", "Santa Fe, NM",
      
      // Southwest
      "Phoenix, AZ", "Tucson, AZ", "Mesa, AZ", "Scottsdale, AZ", "Chandler, AZ",
      "Las Vegas, NV", "Reno, NV", "Henderson, NV",
      
      // Midwest
      "Chicago, IL", "Aurora, IL", "Naperville, IL", "Springfield, IL", "Peoria, IL",
      "Detroit, MI", "Grand Rapids, MI", "Ann Arbor, MI", "Lansing, MI",
      "Minneapolis, MN", "St. Paul, MN", "Rochester, MN", "Duluth, MN",
      "Milwaukee, WI", "Madison, WI", "Green Bay, WI",
      "Indianapolis, IN", "Fort Wayne, IN", "Evansville, IN",
      "Columbus, OH", "Cleveland, OH", "Cincinnati, OH", "Toledo, OH", "Akron, OH",
      "Kansas City, MO", "St. Louis, MO", "Springfield, MO",
      "Omaha, NE", "Lincoln, NE",
      "Des Moines, IA", "Cedar Rapids, IA",
      
      // South
      "Austin, TX", "Dallas, TX", "Houston, TX", "San Antonio, TX", "Fort Worth, TX", "El Paso, TX", "Corpus Christi, TX",
      "Oklahoma City, OK", "Tulsa, OK", "Norman, OK",
      "New Orleans, LA", "Baton Rouge, LA", "Shreveport, LA",
      "Memphis, TN", "Nashville, TN", "Knoxville, TN", "Chattanooga, TN",
      "Louisville, KY", "Lexington, KY",
      "Birmingham, AL", "Montgomery, AL", "Mobile, AL", "Huntsville, AL",
      "Atlanta, GA", "Savannah, GA", "Augusta, GA", "Columbus, GA",
      "Jacksonville, FL", "Miami, FL", "Tampa, FL", "Orlando, FL", "St. Petersburg, FL", "Fort Lauderdale, FL",
      "Charlotte, NC", "Raleigh, NC", "Greensboro, NC", "Durham, NC", "Winston-Salem, NC",
      "Columbia, SC", "Charleston, SC", "Greenville, SC",
      "Richmond, VA", "Virginia Beach, VA", "Norfolk, VA", "Arlington, VA",
      
      // Northeast
      "New York, NY", "Buffalo, NY", "Rochester, NY", "Syracuse, NY", "Albany, NY",
      "Boston, MA", "Worcester, MA", "Springfield, MA", "Cambridge, MA",
      "Philadelphia, PA", "Pittsburgh, PA", "Allentown, PA", "Erie, PA",
      "Baltimore, MD", "Annapolis, MD", "Frederick, MD",
      "Providence, RI", "Warwick, RI",
      "Newark, NJ", "Jersey City, NJ", "Paterson, NJ", "Trenton, NJ", "Camden, NJ",
      "Hartford, CT", "New Haven, CT", "Stamford, CT", "Bridgeport, CT",
      "Washington, DC"
    ];

    for (const location of additionalLocations) {
      this.locations.add(location);
    }
  }
}

export const storage = new MemStorage();
