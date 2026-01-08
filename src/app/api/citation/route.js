import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// Helper to identify input type
function identifyType(input) {
  const trimmed = input.trim();
  if (/^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/.test(trimmed)) return "DOI";
  if (/^https?:\/\/(dx\.)?doi\.org\//.test(trimmed)) return "DOI_URL";
  if (/^PMID:?\s*\d+$/i.test(trimmed) || /^\d{1,8}$/.test(trimmed)) return "PMID"; // Assume short numbers are PMID
  if (/^S2CID:?\s*\d+$/i.test(trimmed)) return "S2CID";
  if (/^https?:\/\/books\.google/.test(trimmed)) return "GOOGLE_BOOKS";
  if (/^https?:\/\//.test(trimmed)) return "WEB_URL"; // Generic URL fallback
  return "UNKNOWN";
}

// Fetchers
async function fetchFromCrossref(doi) {
  const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  const response = await axios.get(`https://api.crossref.org/works/${cleanDoi}`);
  const data = response.data.message;
  
  const title = data.title ? data.title[0] : "";
  const journal = data["container-title"] ? data["container-title"][0] : "";
  const year = data.created?.["date-parts"]?.[0]?.[0] || "";
  const volume = data.volume || "";
  const issue = data.issue || "";
  const pages = data.page || "";
  
  let citation = "{{cite journal";
  if (data.author) {
    data.author.forEach((a, index) => {
        citation += ` | last${index + 1}=${a.family} | first${index + 1}=${a.given}`;
    });
  }
  citation += ` | title=${title}`;
  citation += ` | journal=${journal}`;
  if (year) citation += ` | year=${year}`;
  if (volume) citation += ` | volume=${volume}`;
  if (issue) citation += ` | issue=${issue}`;
  if (pages) citation += ` | pages=${pages}`;
  citation += ` | doi=${cleanDoi}`;
  citation += " }}";

  return citation;
}

async function fetchFromPubMed(pmid) {
  const cleanPmid = pmid.replace(/^PMID:?\s*/i, "");
  const response = await axios.get(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${cleanPmid}&retmode=json`
  );
  
  const result = response.data.result[cleanPmid];
  if (!result) throw new Error("PMID not found");

  const authors = result.authors ? result.authors.map(a => a.name) : [];
  const title = result.title || "";
  const journal = result.source || "";
  const date = result.pubdate || "";
  const year = date.match(/\d{4}/)?.[0] || "";
  const volume = result.volume || "";
  const issue = result.issue || "";
  const pages = result.pages || "";
  const doi = result.elocationid?.replace("doi: ", "") || "";

  let citation = "{{cite journal";
  authors.forEach((a, index) => {
      citation += ` | author${index + 1}=${a}`;
  });
  citation += ` | title=${title}`;
  citation += ` | journal=${journal}`;
  if (year) citation += ` | year=${year}`;
  if (volume) citation += ` | volume=${volume}`;
  if (issue) citation += ` | issue=${issue}`;
  if (pages) citation += ` | pages=${pages}`;
  if (doi) citation += ` | doi=${doi}`;
  citation += ` | pmid=${cleanPmid}`;
  citation += " }}";

  return citation;
}

async function fetchFromGoogleBooks(url) {
  const urlObj = new URL(url);
  const id = urlObj.searchParams.get("id");
  
  if (!id) throw new Error("Could not extract Google Books ID from URL");

  const response = await axios.get(`https://www.googleapis.com/books/v1/volumes/${id}`);
  const info = response.data.volumeInfo;

  let citation = "{{cite book";
  if (info.authors) {
    info.authors.forEach((a, index) => {
        citation += ` | author${index + 1}=${a}`;
    });
  }
  citation += ` | title=${info.title}`;
  if (info.publishedDate) citation += ` | year=${info.publishedDate.substring(0, 4)}`;
  if (info.publisher) citation += ` | publisher=${info.publisher}`;
  if (info.industryIdentifiers) {
    const isbn = info.industryIdentifiers.find(i => i.type === "ISBN_13")?.identifier || info.industryIdentifiers.find(i => i.type === "ISBN_10")?.identifier;
    if (isbn) citation += ` | isbn=${isbn}`;
  }
  citation += ` | url=${url}`;
  citation += " }}";

  return citation;
}

async function fetchFromSemanticScholar(s2cid) {
  const cleanId = s2cid.replace(/^S2CID:?\s*/i, "");
  // Use graph API
  const response = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/S2CID:${cleanId}?fields=title,authors,year,venue,externalIds`);
  const data = response.data;

  if (!data) throw new Error("S2CID not found");

  let citation = "{{cite journal"; // Default to journal, though could be conference
  if (data.authors) {
    data.authors.forEach((a, index) => {
        citation += ` | author${index + 1}=${a.name}`;
    });
  }
  citation += ` | title=${data.title}`;
  if (data.venue) citation += ` | journal=${data.venue}`;
  if (data.year) citation += ` | year=${data.year}`;
  if (data.externalIds && data.externalIds.DOI) citation += ` | doi=${data.externalIds.DOI}`;
  citation += ` | s2cid=${cleanId}`;
  citation += " }}";

  return citation;
}

async function fetchFromWeb(url) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JustapediaCitationBot/1.0; +http://justapedia.org)",
    },
    timeout: 10000 // 10 second timeout
  });
  
  const html = response.data;
  const $ = cheerio.load(html);

  // Helper to get meta tag content
  const getMeta = (prop) => 
    $(`meta[property="${prop}"]`).attr("content") || 
    $(`meta[name="${prop}"]`).attr("content");

  const title = getMeta("og:title") || $("title").text() || "";
  const siteName = getMeta("og:site_name") || "";
  const urlLink = getMeta("og:url") || url;
  
  // Try to find author
  let author = getMeta("article:author") || getMeta("author") || "";
  if (!author) {
    // Basic heuristic for byline
    const byline = $(".author").first().text() || $(".byline").first().text();
    if (byline) author = byline.trim();
  }

  // Try to find date
  let date = getMeta("article:published_time") || getMeta("date") || "";
  if (!date) {
      // Look for time element
      date = $("time").first().attr("datetime") || "";
  }
  
  // Simple ISO date clean up
  if (date) {
      date = date.split("T")[0]; // YYYY-MM-DD
  }

  const accessDate = new Date().toISOString().split("T")[0];

  let citation = "{{cite web";
  if (author) citation += ` | author=${author}`;
  citation += ` | title=${title.trim()}`;
  if (siteName) citation += ` | website=${siteName}`;
  citation += ` | url=${urlLink}`;
  if (date) citation += ` | date=${date}`;
  citation += ` | access-date=${accessDate}`;
  citation += " }}";

  return citation;
}

export async function POST(request) {
  try {
    const { identifier } = await request.json();
    const type = identifyType(identifier);
    
    let citation = "";

    switch (type) {
      case "DOI":
      case "DOI_URL":
        citation = await fetchFromCrossref(identifier);
        break;
      case "PMID":
        citation = await fetchFromPubMed(identifier);
        break;
      case "GOOGLE_BOOKS":
        citation = await fetchFromGoogleBooks(identifier);
        break;
      case "S2CID":
        citation = await fetchFromSemanticScholar(identifier);
        break;
      case "WEB_URL":
        citation = await fetchFromWeb(identifier);
        break;
      default:
        throw new Error("Unsupported identifier format. Please use DOI, PMID, S2CID, Google Books URL, or a Web URL.");
    }

    return NextResponse.json({ citation });
  } catch (error) {
    console.error("API Error:", error.message);
    const msg = error.response?.data?.error || error.message || "Failed to generate citation";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
