/**
 * Fund lookup via FundLibrary.com with CORS proxy fallbacks.
 * Caches results per session. Never guesses — returns unverified if lookup fails.
 */

const cache = new Map();

const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url) {
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(url);
      const resp = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.length > 200) return text;
      }
    } catch {
      // try next proxy
    }
  }
  return null;
}

function parseSearchResults(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try to find a fund detail link in search results
    const links = doc.querySelectorAll('a[href*="Fund"], a[href*="fund"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && (href.includes('FundProfile') || href.includes('FundSnapshot') || href.includes('FundPage'))) {
        const fullUrl = href.startsWith('http') ? href : `https://www.fundlibrary.com${href}`;
        return { detailUrl: fullUrl, linkText: link.textContent?.trim() };
      }
    }

    // Try table rows
    const rows = doc.querySelectorAll('tr, .fund-row, .search-result');
    for (const row of rows) {
      const text = row.textContent || '';
      const link = row.querySelector('a');
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.fundlibrary.com${href}`;
          return { detailUrl: fullUrl, linkText: link.textContent?.trim() || text.trim() };
        }
      }
    }

    // Look for fund name in page title or headings
    const title = doc.querySelector('title')?.textContent || '';
    const h1 = doc.querySelector('h1, h2, .fund-name')?.textContent || '';
    if (h1 && h1.length > 5) return { fundName: h1.trim(), fromSearchPage: true };
    if (title && title.length > 10 && !title.toLowerCase().includes('search')) {
      return { fundName: title.trim(), fromSearchPage: true };
    }

    return null;
  } catch {
    return null;
  }
}

function parseFundDetailPage(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const result = {
      fullName: null,
      fundCompany: null,
      cifscCategory: null,
      dataAsAt: null,
      assetAllocation: [],
      geographicAllocation: [],
    };

    // Fund name from title or heading
    const h1 = doc.querySelector('h1, .fund-name, .fund-title, [data-fund-name]');
    if (h1) result.fullName = h1.textContent.trim();
    if (!result.fullName) {
      const title = doc.querySelector('title')?.textContent || '';
      if (title) result.fullName = title.split('|')[0]?.trim() || title.split('-')[0]?.trim();
    }

    // Look for data in tables and definition lists
    const allText = doc.body?.textContent || '';

    // Fund company
    const companyPatterns = [/Fund Company[:\s]*([^\n]+)/i, /Manager[:\s]*([^\n]+)/i, /Fund Family[:\s]*([^\n]+)/i];
    for (const pat of companyPatterns) {
      const m = allText.match(pat);
      if (m) { result.fundCompany = m[1].trim(); break; }
    }

    // CIFSC Category
    const catPatterns = [/CIFSC Category[:\s]*([^\n]+)/i, /Category[:\s]*([^\n]+)/i, /Fund Category[:\s]*([^\n]+)/i];
    for (const pat of catPatterns) {
      const m = allText.match(pat);
      if (m) { result.cifscCategory = m[1].trim(); break; }
    }

    // Data as-at date
    const datePatterns = [/as (?:at|of)[:\s]*([A-Za-z]+ \d{1,2},? \d{4})/i, /Data as at[:\s]*([^\n]+)/i, /(\w+ \d{1,2},? \d{4})/];
    for (const pat of datePatterns) {
      const m = allText.match(pat);
      if (m) { result.dataAsAt = m[1].trim(); break; }
    }

    // Parse tables for asset allocation and geographic allocation
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const heading = table.previousElementSibling?.textContent?.toLowerCase() || '';
      const caption = table.querySelector('caption')?.textContent?.toLowerCase() || '';
      const headerText = heading + ' ' + caption;

      const rows = table.querySelectorAll('tr');
      const data = [];
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const name = cells[0].textContent.trim();
          const value = parseFloat(cells[cells.length - 1].textContent.replace(/[%,]/g, ''));
          if (name && !isNaN(value) && value > 0 && value <= 100) {
            data.push({ name, percent: value });
          }
        }
      }

      if (data.length > 0) {
        if (headerText.includes('asset') || headerText.includes('allocation') || headerText.includes('sector')) {
          result.assetAllocation = data;
        } else if (headerText.includes('geograph') || headerText.includes('region') || headerText.includes('country')) {
          result.geographicAllocation = data;
        } else if (result.assetAllocation.length === 0) {
          // First table with percentage data — assume asset allocation
          result.assetAllocation = data;
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

export async function lookupFund(code) {
  if (cache.has(code)) return cache.get(code);

  const unverified = {
    code,
    verified: false,
    fullName: null,
    fundCompany: null,
    cifscCategory: null,
    dataAsAt: null,
    assetAllocation: [],
    geographicAllocation: [],
  };

  try {
    // Step 1: Search FundLibrary
    const searchUrl = `https://www.fundlibrary.com/MutualFunds/Search?keywords=${encodeURIComponent(code)}`;
    const searchHtml = await fetchWithProxy(searchUrl);

    if (!searchHtml) {
      cache.set(code, unverified);
      return unverified;
    }

    // Step 2: Try to parse search results
    const searchResult = parseSearchResults(searchHtml);

    // Maybe the search page IS the detail page (redirect)
    const directParse = parseFundDetailPage(searchHtml);
    if (directParse && directParse.fullName) {
      const result = {
        code,
        verified: true,
        ...directParse,
      };
      cache.set(code, result);
      return result;
    }

    // Step 3: If we found a detail link, fetch it
    if (searchResult?.detailUrl) {
      const detailHtml = await fetchWithProxy(searchResult.detailUrl);
      if (detailHtml) {
        const detail = parseFundDetailPage(detailHtml);
        if (detail && detail.fullName) {
          const result = { code, verified: true, ...detail };
          cache.set(code, result);
          return result;
        }
      }
    }

    // If we got a fund name from search results but no detail
    if (searchResult?.fundName || searchResult?.linkText) {
      const result = {
        ...unverified,
        verified: true,
        fullName: searchResult.fundName || searchResult.linkText,
      };
      cache.set(code, result);
      return result;
    }

    cache.set(code, unverified);
    return unverified;
  } catch {
    cache.set(code, unverified);
    return unverified;
  }
}

export async function lookupAllFunds(codes, onProgress) {
  const results = {};
  const uniqueCodes = [...new Set(codes)];
  let completed = 0;

  // Run in batches of 3 to be polite to the proxy
  for (let i = 0; i < uniqueCodes.length; i += 3) {
    const batch = uniqueCodes.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map((code) => lookupFund(code)));
    batch.forEach((code, idx) => {
      results[code] = batchResults[idx];
    });
    completed += batch.length;
    onProgress?.(completed, uniqueCodes.length);
  }

  return results;
}

export function clearCache() {
  cache.clear();
}
