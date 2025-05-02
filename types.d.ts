// Add declaration for the google-search-results-nodejs module
declare module 'google-search-results-nodejs' {
  export default class SerpApi {
    constructor(apiKey: string);
    
    json(
      params: Record<string, any>,
      callback: (data: any, error: any) => void
    ): void;
  }
}