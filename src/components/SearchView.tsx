import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, User, Bot, Edit, Share, Plus, FileText, Code, Users, Upload, Loader2, Filter, Eye, Clock, Zap } from 'lucide-react';
import { SearchQuery, CandidateMatch, Candidate, MatchExplanation } from '../types';
import { extractEntities, calculateMatchWithAI } from '../utils/searchUtils';
import { searchCandidatesWithStreaming } from '../utils/streamingSearch';
import CandidateTable from './CandidateTable';
import FilterModal from './FilterModal';
import { Project, getSearchResults } from '../lib/supabase';
import { convertDatabaseCandidatesToCandidates } from '../utils/dataConverters';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  extractedFilters?: any;
  searchQuery?: SearchQuery;
  isProcessing?: boolean;
  showSearchButton?: boolean;
  noResultsFound?: boolean;
  searchProgress?: {
    stage: string;
    current: number;
    total: number;
    message: string;
  };
}

interface SearchViewProps {
  onSearch: (query: SearchQuery) => void;
  matches: CandidateMatch[];
  isLoading: boolean;
  recentSearches?: string[];
  candidates: Candidate[];
  currentProject?: Project | null;
}

const SearchView: React.FC<SearchViewProps> = ({ 
  onSearch, 
  matches, 
  isLoading, 
  recentSearches = [],
  candidates,
  currentProject
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeSearchMethod, setActiveSearchMethod] = useState('natural');
  const [currentFilters, setCurrentFilters] = useState<any>(null);
  const [currentMatches, setCurrentMatches] = useState<CandidateMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<SearchQuery | null>(null);
  const [recentSearchContext, setRecentSearchContext] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchMethods = [
    { 
      id: 'natural', 
      label: 'Natural Language', 
      icon: Sparkles, 
      placeholder: 'Describe the candidate you\'re looking for...'
    },
    { 
      id: 'jd', 
      label: 'Job Description', 
      icon: FileText, 
      placeholder: 'Paste job description here...'
    }
  ];

  // Update current matches when matches prop changes
  React.useEffect(() => {
    if (matches && matches.length > 0) {
      setCurrentMatches(matches);
      setShowResults(true);
    }
  }, [matches]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not processing
  useEffect(() => {
    if (!isProcessing && !isSearching) {
      inputRef.current?.focus();
    }
  }, [isProcessing, isSearching]);

  // Add logging for currentFilters state changes
  useEffect(() => {
    console.log('🔍 FILTER STATE DEBUG: currentFilters state changed:', currentFilters);
  }, [currentFilters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    console.log('🚀 Starting search process for query:', inputValue);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Add processing message with animated progress
    const processingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Analyzing your query with AI to extract search criteria...',
      timestamp: new Date(),
      isProcessing: true,
      searchProgress: {
        stage: 'extraction',
        current: 1,
        total: 3,
        message: 'Extracting entities from your query...'
      }
    };
    setMessages(prev => [...prev, processingMessage]);

    try {
      console.log('🔍 Starting AI entity extraction...');
      
      // Extract entities using AI
      const searchQuery = await extractEntities(inputValue);
      setCurrentSearchQuery(searchQuery);
      
      console.log('✅ Entity extraction completed:', searchQuery);
      console.log('🔍 FILTER STATE DEBUG: About to create filters from searchQuery:', searchQuery);
      
      // Create filters display object
      const filters = {
        jobTitles: searchQuery.extractedEntities.jobTitles,
        locations: searchQuery.extractedEntities.locations,
        experienceRange: searchQuery.extractedEntities.experienceRange,
        skills: searchQuery.extractedEntities.skills,
        industries: searchQuery.extractedEntities.industries,
        education: searchQuery.extractedEntities.education
      };

      console.log('🔍 FILTER STATE DEBUG: Created filters object:', filters);
      setCurrentFilters(filters);
      console.log('🔍 FILTER STATE DEBUG: Called setCurrentFilters with:', filters);

      // Remove processing message and add filter extraction result
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: `Perfect! I've analyzed your query and extracted the search criteria below. These filters will be applied to narrow down from our database of ${candidates.length.toLocaleString()} candidates.`,
        timestamp: new Date(),
        extractedFilters: filters,
        searchQuery: searchQuery,
        showSearchButton: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ Filter extraction UI updated');
      
    } catch (error) {
      console.error('❌ Filter extraction error:', error);
      
      // Remove processing message and show error
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while analyzing your query. Please try again or check your API key configuration.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setInputValue('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleSearchCandidates = async (searchQuery: SearchQuery) => {
    if (!searchQuery || isSearching) return;

    console.log('🔍 Starting streaming candidate search...');
    console.log('📊 Search parameters:', searchQuery);
    console.log('🔍 FILTER STATE DEBUG: currentFilters before search:', currentFilters);
    console.log('🔍 FILTER STATE DEBUG: currentSearchQuery before search:', currentSearchQuery);

    setIsSearching(true);
    setCurrentMatches([]);
    
    // Add searching message with progress tracking
    const searchingMessage: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content: 'Searching through candidates with intelligent filtering and AI-powered matching...',
      timestamp: new Date(),
      isProcessing: true,
      searchProgress: {
        stage: 'searching',
        current: 2,
        total: 3,
        message: 'Applying smart filters and AI analysis...'
      }
    };
    setMessages(prev => [...prev, searchingMessage]);

    // Simulate processing delay (e.g., 800ms)
    await new Promise(res => setTimeout(res, 1200));

    try {
      console.log('🤖 Starting streaming search with real-time updates...');
      
      // STEP 1: Apply basic filtering to get initial candidates immediately
      console.log('🔧 STEP 1: Applying basic filtering for immediate results...');
      const initialMatches = await getInitialCandidatesWithBasicFiltering(candidates, searchQuery);
      
      if (initialMatches.length === 0) {
        // Remove searching message and show no results
        setMessages(prev => prev.filter(msg => !msg.isProcessing));
        const noResultsMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `❌ No candidates found matching your search criteria.`,
          timestamp: new Date(),
          noResultsFound: true
        };
        setMessages(prev => [...prev, noResultsMessage]);
        return;
      }
      
      // STEP 2: Immediately show initial candidates in table
      console.log(`📊 Showing ${initialMatches.length} initial candidates in table...`);
      setCurrentMatches(initialMatches);
      setShowResults(true); // Immediately show the table
      
      // Remove searching message and show initial results
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      const initialResultsMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `🎯 Found ${initialMatches.length} candidates! AI analysis is running in the background to improve match scores...`,
        timestamp: new Date(),
        noResultsFound: false
      };
      setMessages(prev => [...prev, initialResultsMessage]);
      
      // STEP 3: Run AI analysis on each candidate and update table in real-time
      console.log('🤖 STEP 3: Running AI analysis on candidates with real-time updates...');
      await runAIAnalysisWithRealTimeUpdates(initialMatches, searchQuery);
      
      // Call the parent onSearch for any additional handling
      onSearch(searchQuery);
      
    } catch (error) {
      console.error('❌ Search error:', error);
      
      // Remove searching message and show error
      setMessages(prev => prev.filter(msg => !msg.isProcessing));
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while searching candidates. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  // New function to get initial candidates with basic filtering
  const getInitialCandidatesWithBasicFiltering = async (candidates: Candidate[], searchQuery: SearchQuery): Promise<CandidateMatch[]> => {
    console.log('🔧 Applying basic filtering for immediate results...');
    
    // Apply hard filters first
    const filteredCandidates = applyLenientHardFilters(candidates, searchQuery);
    console.log(`✂️ Hard filters reduced candidates from ${candidates.length} to ${filteredCandidates.length}`);
    
    if (filteredCandidates.length === 0) {
      return [];
    }
    
    // Apply keyword matching
    const keywordMatches = applySimpleKeywordMatching(filteredCandidates, searchQuery);
    console.log(`🎯 Keyword matching selected ${keywordMatches.length} candidates`);
    
    if (keywordMatches.length === 0) {
      return [];
    }
    
    // Take top candidates and calculate basic scores
    const topCandidates = keywordMatches.slice(0, 20);
    const initialMatches: CandidateMatch[] = topCandidates.map(candidate => {
      const explanation = calculateBasicMatch(candidate, searchQuery);
      return { candidate, explanation, streamingExplanation: 'Analyzing...' };
    });
    
    // Sort by basic score
    const sortedMatches = initialMatches.sort((a, b) => b.explanation.score - a.explanation.score);
    console.log(`✅ Initial filtering complete: ${sortedMatches.length} candidates with basic scores`);
    
    return sortedMatches;
  };

  // New function to run AI analysis with real-time table updates
  const runAIAnalysisWithRealTimeUpdates = async (initialMatches: CandidateMatch[], searchQuery: SearchQuery) => {
    console.log('🤖 Starting AI analysis with real-time table updates...');
    
    const updatedMatches = [...initialMatches];
    
    // Process candidates in smaller batches for better performance
    const batchSize = 3;
    for (let i = 0; i < updatedMatches.length; i += batchSize) {
      const batch = updatedMatches.slice(i, i + batchSize);
      console.log(`📦 Processing AI batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updatedMatches.length/batchSize)} (${batch.length} candidates)`);
      
      const batchPromises = batch.map(async (match, index) => {
        const candidate = match.candidate;
        console.log(`🔄 Starting AI analysis for candidate ${i + index + 1}: ${candidate.name}`);
        
        try {
          const aiExplanation = await calculateMatchWithAI(candidate, searchQuery, i + index + 1);
          console.log(`✅ AI analysis complete for ${candidate.name}: Score ${aiExplanation.score}%, Category: ${aiExplanation.category}`);

          // Stream the first reason by word with natural delay
          const fullText = aiExplanation.reasons[0] || '';
          const words = fullText.split(/(\s+)/); // keep spaces
          let currentText = '';
          for (let w = 0; w < words.length; w++) {
            currentText += words[w];
            // Update streamingExplanation for this candidate only, leave others untouched
            setCurrentMatches(prevMatches =>
              prevMatches.map(m =>
                m.candidate.id === candidate.id
                  ? { ...m, streamingExplanation: currentText }
                  : m
              )
            );
            // Random delay: 30-70ms, longer after punctuation
            let delay = 30 + Math.random() * 40;
            if (/[\.,!?]$/.test(words[w].trim())) delay += 80;
            await new Promise(res => setTimeout(res, delay));
          }
          // After streaming, set the final explanation and remove streamingExplanation
          const finalMatches = updatedMatches.map(m =>
            m.candidate.id === candidate.id
              ? { ...m, explanation: aiExplanation, streamingExplanation: undefined }
              : m
          );
          setCurrentMatches([...finalMatches]);
          // Also update in updatedMatches for next batches
          const idx = updatedMatches.findIndex(m => m.candidate.id === candidate.id);
          if (idx !== -1) updatedMatches[idx] = { ...updatedMatches[idx], explanation: aiExplanation, streamingExplanation: undefined };

          return { candidate, explanation: aiExplanation };
        } catch (error) {
          console.log(`⚠️ AI analysis failed for ${candidate.name}, keeping basic score`);
          return match; // Keep the original basic match
        }
      });
      
      try {
        await Promise.all(batchPromises);
        // No need to update setCurrentMatches here, it's done in streaming
        // Small delay between batches to respect rate limits
        if (i + batchSize < updatedMatches.length) {
          console.log('⏳ Waiting 300ms before next batch...');
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('❌ Error processing AI batch:', error);
        // Continue with next batch
      }
    }
    
    console.log('🎯 AI analysis with real-time updates completed!');
  };

  // Helper functions (these would need to be imported or defined)
  const applyLenientHardFilters = (candidates: Candidate[], searchQuery: SearchQuery): Candidate[] => {
    // This function should be imported from searchUtils.ts
    // For now, I'll create a simplified version
    console.log('🔧 Applying lenient hard filters...');
    const { extractedEntities } = searchQuery;
    
    let filtered = candidates;
    
    // Job Title Hard Filter (more lenient - partial matches)
    if (extractedEntities.jobTitles && extractedEntities.jobTitles.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(candidate => {
        if (!candidate || !candidate.jobTitle || typeof candidate.jobTitle !== 'string') {
          return false;
        }
        
        const candidateTitle = candidate.jobTitle.toLowerCase();
        return extractedEntities.jobTitles.some(title => {
          if (!title || typeof title !== 'string') return false;
          
          const titleLower = title.toLowerCase();
          return (
            candidateTitle.includes(titleLower) ||
            titleLower.includes(candidateTitle) ||
            (titleLower.includes('nurse') && candidateTitle.includes('nurse')) ||
            (titleLower.includes('administrator') && candidateTitle.includes('administrator')) ||
            (titleLower.includes('technologist') && candidateTitle.includes('technologist')) ||
            (titleLower.includes('therapist') && candidateTitle.includes('therapist')) ||
            (titleLower === 'rn' && candidateTitle.includes('nurse')) ||
            (titleLower === 'np' && candidateTitle.includes('practitioner')) ||
            (titleLower === 'lpn' && candidateTitle.includes('practical')) ||
            (titleLower === 'cns' && candidateTitle.includes('specialist'))
          );
        });
      });
      console.log(`📋 Job title filter: ${beforeCount} → ${filtered.length} candidates`);
    }
    
    // Location Hard Filter (more lenient - partial matches)
    if (extractedEntities.locations && extractedEntities.locations.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(candidate => {
        if (!candidate || !candidate.location || typeof candidate.location !== 'string') {
          return false;
        }
        
        const candidateLocation = candidate.location.toLowerCase();
        return extractedEntities.locations.some(location => {
          if (!location || typeof location !== 'string') return false;
          
          const locationLower = location.toLowerCase();
          return (
            candidateLocation.includes(locationLower) || locationLower.includes(candidateLocation)
          );
        });
      });
      console.log(`📍 Location filter: ${beforeCount} → ${filtered.length} candidates`);
    }
    
    // Experience Hard Filter (more lenient - allow ±2 years variance)
    if (extractedEntities.experienceRange && extractedEntities.experienceRange.min !== undefined) {
      const beforeCount = filtered.length;
      const minExp = Math.max(0, extractedEntities.experienceRange.min - 2);
      const maxExp = extractedEntities.experienceRange.max ? 
        extractedEntities.experienceRange.max + 2 : undefined;
      
      filtered = filtered.filter(candidate => {
        if (!candidate || typeof candidate.experience !== 'number') {
          return false;
        }
        
        if (maxExp !== undefined) {
          return candidate.experience >= minExp && candidate.experience <= maxExp;
        } else {
          return candidate.experience >= minExp;
        }
      });
      console.log(`⏱️ Experience filter (${minExp}${maxExp ? `-${maxExp}` : '+'}): ${beforeCount} → ${filtered.length} candidates`);
    }
    
    console.log(`✅ Lenient hard filters complete: ${candidates.length} → ${filtered.length} candidates`);
    return filtered;
  };

  const applySimpleKeywordMatching = (candidates: Candidate[], searchQuery: SearchQuery): Candidate[] => {
    console.log('🔧 Applying simple keyword matching for relevance scoring...');
    const { extractedEntities, originalQuery } = searchQuery;
    
    // Extract all keywords from the original query
    const queryKeywords = originalQuery.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'or', 'in', 'at', 'with', 'for', 'of', 'to', 'a', 'an'].includes(word));
    
    console.log('🔍 Query keywords:', queryKeywords);
    
    // Calculate simple keyword scores for each candidate
    const candidatesWithScores = candidates.map(candidate => {
      if (!candidate) {
        return { candidate, keywordScore: 0 };
      }
      
      let keywordScore = 0;
      
      // Check job title keywords
      if (candidate.jobTitle && typeof candidate.jobTitle === 'string') {
        const titleWords = candidate.jobTitle.toLowerCase().split(/\s+/);
        queryKeywords.forEach(keyword => {
          if (titleWords.some(word => word.includes(keyword) || keyword.includes(word))) {
            keywordScore += 15;
          }
        });
      }
      
      // Check skills keywords
      if (candidate.skills && Array.isArray(candidate.skills)) {
        const skillsText = candidate.skills.join(' ').toLowerCase();
        queryKeywords.forEach(keyword => {
          if (skillsText.includes(keyword)) {
            keywordScore += 10;
          }
        });
      }
      
      // Check summary keywords
      if (candidate.summary && typeof candidate.summary === 'string') {
        const summaryText = candidate.summary.toLowerCase();
        queryKeywords.forEach(keyword => {
          if (summaryText.includes(keyword)) {
            keywordScore += 5;
          }
        });
      }
      
      // Check location keywords
      if (candidate.location && typeof candidate.location === 'string') {
        const locationText = candidate.location.toLowerCase();
        queryKeywords.forEach(keyword => {
          if (locationText.includes(keyword)) {
            keywordScore += 12;
          }
        });
      }
      
      // Bonus for specific skill matches
      if (extractedEntities.skills && extractedEntities.skills.length > 0 && candidate.skills && Array.isArray(candidate.skills)) {
        const skillMatches = extractedEntities.skills.filter(skill => 
          candidate.skills.some(candidateSkill => {
            if (!skill || !candidateSkill || typeof skill !== 'string' || typeof candidateSkill !== 'string') {
              return false;
            }
            return candidateSkill.toLowerCase().includes(skill.toLowerCase()) ||
                   skill.toLowerCase().includes(candidateSkill.toLowerCase());
          })
        );
        keywordScore += skillMatches.length * 8;
      }
      
      // Availability bonus
      if (candidate.availability === 'available') {
        keywordScore += 5;
      } else if (candidate.availability === 'passive') {
        keywordScore += 3;
      }
      
      return { candidate, keywordScore };
    });
    
    // Sort by keyword score and take candidates with meaningful scores
    const sortedCandidates = candidatesWithScores
      .filter(item => item.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore);
    
    const result = sortedCandidates.map(item => item.candidate);
    console.log(`✅ Keyword matching complete: Selected ${result.length} candidates for AI analysis`);
    return result;
  };

  const calculateBasicMatch = (candidate: Candidate, searchQuery: SearchQuery): MatchExplanation => {
    if (!candidate) {
      return {
        score: 0,
        reasons: ['Invalid candidate data'],
        category: 'potential'
      };
    }

    console.log(`🔄 Calculating basic match for ${candidate.name || 'Unknown'}...`);
    
    let score = 0;
    const reasons: string[] = [];
    const { extractedEntities } = searchQuery;
    
    // Job title matching (40% weight) - more lenient
    const jobTitleMatch = extractedEntities.jobTitles?.some(title => {
      if (!title || typeof title !== 'string' || !candidate.jobTitle || typeof candidate.jobTitle !== 'string') {
        return false;
      }
      
      const titleLower = title.toLowerCase();
      const candidateTitleLower = candidate.jobTitle.toLowerCase();
      return (
        candidateTitleLower.includes(titleLower) ||
        titleLower.includes(candidateTitleLower) ||
        (titleLower.includes('nurse') && candidateTitleLower.includes('nurse')) ||
        (titleLower.includes('administrator') && candidateTitleLower.includes('administrator'))
      );
    });
    
    if (jobTitleMatch) {
      score += 40;
      reasons.push(`Job title alignment: ${candidate.jobTitle || 'Unknown'}`);
    } else if (!extractedEntities.jobTitles || extractedEntities.jobTitles.length === 0) {
      score += 20;
      reasons.push(`Healthcare professional: ${candidate.jobTitle || 'Unknown'}`);
    }
    
    // Location matching (25% weight) - more lenient
    const locationMatch = extractedEntities.locations?.some(location => {
      if (!location || typeof location !== 'string' || !candidate.location || typeof candidate.location !== 'string') {
        return false;
      }
      
      const locationLower = location.toLowerCase();
      const candidateLocationLower = candidate.location.toLowerCase();
      return (
        candidateLocationLower.includes(locationLower) ||
        locationLower.includes(candidateLocationLower)
      );
    });
    
    if (locationMatch) {
      score += 25;
      reasons.push(`Located in target area: ${candidate.location || 'Unknown'}`);
    } else if (!extractedEntities.locations || extractedEntities.locations.length === 0) {
      score += 15;
      reasons.push(`Available location: ${candidate.location || 'Unknown'}`);
    }
    
    // Experience matching (20% weight) - more lenient
    if (extractedEntities.experienceRange && (extractedEntities.experienceRange.min || extractedEntities.experienceRange.max)) {
      const minExp = Math.max(0, (extractedEntities.experienceRange.min || 0) - 2);
      const maxExp = extractedEntities.experienceRange.max ? 
        extractedEntities.experienceRange.max + 2 : 50;
      
      const candidateExp = candidate.experience || 0;
      
      if (candidateExp >= minExp && candidateExp <= maxExp) {
        score += 20;
        reasons.push(`Experience level: ${candidateExp} years meets requirements`);
      } else if (candidateExp >= minExp - 2) {
        score += 10;
        reasons.push(`Close experience match: ${candidateExp} years`);
      }
    } else {
      score += 15;
      reasons.push(`${candidate.experience || 0} years of experience`);
    }
    
    // Skills matching (15% weight) - more lenient
    const skillMatches = extractedEntities.skills?.filter(skill => {
      if (!skill || typeof skill !== 'string' || !candidate.skills || !Array.isArray(candidate.skills)) {
        return false;
      }
      
      return candidate.skills.some(candidateSkill => {
        if (!candidateSkill || typeof candidateSkill !== 'string') return false;
        return candidateSkill.toLowerCase().includes(skill.toLowerCase()) ||
               skill.toLowerCase().includes(candidateSkill.toLowerCase());
      });
    }) || [];
    
    if (skillMatches.length > 0) {
      score += Math.min(15, skillMatches.length * 5);
      reasons.push(`Relevant skills: ${skillMatches.join(', ')}`);
    } else {
      score += 5;
      const candidateSkills = candidate.skills && Array.isArray(candidate.skills) ? candidate.skills : [];
      reasons.push(`Professional skills: ${candidateSkills.slice(0, 2).join(', ') || 'Various skills'}`);
    }
    
    // Add base score for healthcare industry
    if (candidate.industry === 'Healthcare') {
      score += 10;
      reasons.push('Healthcare industry experience');
    }
    
    // Availability bonus
    if (candidate.availability === 'available') {
      score += 5;
      reasons.push('Currently available');
    } else if (candidate.availability === 'passive') {
      score += 3;
      reasons.push('Open to opportunities');
    }
    
    // Determine category with lower thresholds
    let category: 'excellent' | 'good' | 'potential';
    if (score >= 85) category = 'excellent';
    else if (score >= 65) category = 'good';
    else category = 'potential';
    
    if (reasons.length === 0) {
      reasons.push('Healthcare professional profile');
    }
    
    // Ensure minimum score of 30 for any healthcare professional
    const finalScore = Math.max(score, 30);
    
    const result = { score: finalScore, reasons, category };
    console.log(`🔄 Basic match result for ${candidate.name || 'Unknown'}:`, result);
    return result;
  };

  const handleEditFilters = (filters: any) => {
    console.log('✏️ Editing filters:', filters);
    console.log('🔍 FILTER STATE DEBUG: handleEditFilters called with:', filters);
    setCurrentFilters(filters);
    
    // Update the search query with new filters
    if (currentSearchQuery) {
      const updatedQuery: SearchQuery = {
        ...currentSearchQuery,
        extractedEntities: {
          jobTitles: filters.jobTitles || [],
          locations: filters.locations || [],
          experienceRange: filters.experienceRange || {},
          skills: filters.skills || [],
          industries: filters.industries || [],
          education: filters.education
        }
      };
      setCurrentSearchQuery(updatedQuery);
      console.log('✅ Search query updated with new filters:', updatedQuery);
      console.log('🔍 FILTER STATE DEBUG: Updated currentSearchQuery:', updatedQuery);
    }
  };

  const handleRecentSearchClick = async (search: string) => {
    console.log('🔍 Clicked recent search:', search);
    console.log('🔍 FILTER STATE DEBUG: handleRecentSearchClick called for:', search);
    
    if (!currentProject) {
      console.error('❌ No current project selected');
      return;
    }

    try {
      // Try to load saved search results with extracted entities
      const { data: searchData, error, extracted_entities } = await getSearchResults(search, currentProject.id);
      
      if (error) {
        console.error('❌ Error loading search results:', error);
        // Fall back to new search
        setInputValue(search);
        return;
      }

      if (searchData && searchData.length > 0) {
        console.log('✅ Loaded saved search data:', searchData.length);
        console.log('🔍 FILTER STATE DEBUG: Retrieved extracted_entities:', extracted_entities);
        
        // Convert database candidates to frontend format
        const candidateMatches: CandidateMatch[] = searchData.map((result: any) => {
          // Find the candidate in our current candidates array
          const candidate = candidates.find(c => c.id === result.candidate_id);
          if (!candidate) {
            console.warn('⚠️ Candidate not found for result:', result.candidate_id);
            return null;
          }
          
          return {
            candidate,
            explanation: {
              score: result.score || 0,
              category: result.category || 'potential',
              reasons: result.reasons || ['Saved search result']
            }
          };
        }).filter(Boolean);

        setCurrentMatches(candidateMatches);
        setShowResults(true);
        setRecentSearchContext(search);
        
        // Extract filters from the saved search record
        if (extracted_entities) {
          console.log('🔍 Found saved extracted entities:', extracted_entities);
          console.log('🔍 FILTER STATE DEBUG: extracted_entities from database:', extracted_entities);
          
          const filters = {
            jobTitles: extracted_entities.jobTitles || [],
            locations: extracted_entities.locations || [],
            experienceRange: extracted_entities.experienceRange || {},
            skills: extracted_entities.skills || [],
            industries: extracted_entities.industries || [],
            education: extracted_entities.education
          };
          
          console.log('🔍 FILTER STATE DEBUG: Created filters from database entities:', filters);
          setCurrentFilters(filters);
          console.log('🔍 FILTER STATE DEBUG: Called setCurrentFilters with database filters:', filters);
          
          // Create search query object
          const searchQuery: SearchQuery = {
            originalQuery: search,
            extractedEntities: extracted_entities
          };
          setCurrentSearchQuery(searchQuery);
          console.log('🔍 FILTER STATE DEBUG: Set currentSearchQuery from database:', searchQuery);
          
          console.log('✅ Filters loaded from database:', filters);
        } else {
          console.log('⚠️ No extracted entities found in saved search, extracting from query...');
          console.log('🔍 FILTER STATE DEBUG: No extracted_entities in database, falling back to extraction');
          
          // Fallback: extract entities from the search string
          try {
            const searchQuery = await extractEntities(search);
            const filters = {
              jobTitles: searchQuery.extractedEntities.jobTitles || [],
              locations: searchQuery.extractedEntities.locations || [],
              experienceRange: searchQuery.extractedEntities.experienceRange || {},
              skills: searchQuery.extractedEntities.skills || [],
              industries: searchQuery.extractedEntities.industries || [],
              education: searchQuery.extractedEntities.education
            };
            console.log('🔍 FILTER STATE DEBUG: Extracted filters from query text:', filters);
            setCurrentFilters(filters);
            setCurrentSearchQuery(searchQuery);
            console.log('✅ Filters extracted from query text:', filters);
            console.log('🔍 FILTER STATE DEBUG: Set filters and searchQuery from extraction:', { filters, searchQuery });
          } catch (filterError) {
            console.warn('⚠️ Could not extract filters for recent search:', filterError);
            console.log('🔍 FILTER STATE DEBUG: Filter extraction failed, using basic filters');
            // Set basic empty filters
            const basicFilters = {
              jobTitles: [],
              locations: [],
              experienceRange: {},
              skills: [],
              industries: [],
              education: null
            };
            setCurrentFilters(basicFilters);
            
            const basicSearchQuery: SearchQuery = {
              originalQuery: search,
              extractedEntities: {
                jobTitles: [],
                locations: [],
                experienceRange: {},
                skills: [],
                industries: [],
                education: undefined
              }
            };
            setCurrentSearchQuery(basicSearchQuery);
            console.log('✅ Set basic filters for recent search');
            console.log('🔍 FILTER STATE DEBUG: Set basic filters and searchQuery:', { basicFilters, basicSearchQuery });
          }
        }
        
        // Clear any existing messages and show a simple message about loaded results
        setMessages([]);
        const loadedMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `📋 Loaded saved search results for "${search}" - ${candidateMatches.length} candidates found.`,
          timestamp: new Date()
        };
        setMessages([loadedMessage]);
        
        console.log('✅ Displaying saved search results');
        console.log('🔍 FILTER STATE DEBUG: Final state after recent search load - currentFilters:', currentFilters);
      } else {
        // No saved results, perform new search
        console.log('🔄 No saved results, performing new search');
        console.log('🔍 FILTER STATE DEBUG: No saved results found, falling back to new search');
        setInputValue(search);
        // Auto-submit the search
        setTimeout(() => {
          const form = document.querySelector('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error handling recent search click:', error);
      console.log('🔍 FILTER STATE DEBUG: Error in handleRecentSearchClick:', error);
      // Fall back to new search
      setInputValue(search);
    }
  };

  // Expose the handleRecentSearchClick function to parent components
  React.useEffect(() => {
    // This effect will run when the component mounts or when dependencies change
    // We can use this to handle external recent search clicks
    const handleExternalRecentSearch = (event: CustomEvent) => {
      handleRecentSearchClick(event.detail.search);
    };

    window.addEventListener('recentSearchClick', handleExternalRecentSearch as EventListener);
    
    return () => {
      window.removeEventListener('recentSearchClick', handleExternalRecentSearch as EventListener);
    };
  }, [candidates, currentProject]);

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">AI Candidate Search</h1>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                {candidates.length.toLocaleString()} Candidates
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                Streaming Search
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                console.log('🔄 Starting new search session...');
                console.log('🔍 FILTER STATE DEBUG: New search button clicked, clearing all state');
                setMessages([]);
                setShowResults(false);
                setCurrentMatches([]);
                setCurrentFilters(null);
                setCurrentSearchQuery(null);
                setRecentSearchContext(null);
                console.log('🔍 FILTER STATE DEBUG: All state cleared for new search');
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              New Search
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {!showResults ? (
          /* Search Interface */
          <div className="flex-1 flex flex-col">
            {/* Search Method Buttons */}
            <div className="bg-white px-6 py-4 border-b border-gray-100">
              <div className="flex gap-2">
                {searchMethods.map((method) => {
                  const Icon = method.icon;
                  const isActive = activeSearchMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => {
                        console.log('🔄 Switching search method to:', method.label);
                        setActiveSearchMethod(method.id);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-8 bg-gray-50">
              <div className="max-w-4xl mx-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                      Intelligent Candidate Search
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
                      {[
                        "Registered Nurse in New York specializing in pediatric care, with 5+ years of experience",
                        "Clinical Nurse Specialist in London focusing on oncology, holding a master's degree",
                        "Emergency Room Nurse in Los Angeles, bilingual in Spanish and English",
                        "Healthcare Administrator in Toronto with 10+ years managing clinics"
                      ].map((query, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            console.log('📝 Using example query:', query);
                            setInputValue(query);
                          }}
                          className="p-4 text-left bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all duration-200 group"
                        >
                          <div className="flex items-start gap-3">
                            <Search className="w-5 h-5 text-purple-600 mt-0.5 group-hover:scale-110 transition-transform" />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">
                              {query}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div key={message.id} className="flex gap-4">
                        <div className="flex-shrink-0">
                          {message.type === 'user' ? (
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">U</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              {message.isProcessing ? (
                                <Loader2 className="w-5 h-5 text-white animate-spin" />
                              ) : (
                                <Sparkles className="w-5 h-5 text-white" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <p className="text-gray-800">{message.content}</p>
                            
                            {/* Progress indicator for processing messages */}
                            {message.isProcessing && message.searchProgress && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-medium text-gray-900">
                                    Step {message.searchProgress.current} of {message.searchProgress.total}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(message.searchProgress.current / message.searchProgress.total) * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-600">{message.searchProgress.message}</p>
                              </div>
                            )}
                            
                            {/* No Results Found UI */}
                            {message.type === 'assistant' && message.noResultsFound && (
                              <div className="mt-6 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                                <Users className="w-16 h-16 text-red-400 mx-auto mb-4" />
                                <h4 className="text-xl font-semibold text-red-800 mb-2">No Candidates Found</h4>
                                <p className="text-red-700 mb-6">
                                  Your current search criteria did not yield any matches in our database.
                                  Please try adjusting your filters or broadening your search.
                                </p>
                                <div className="flex justify-center gap-4">
                                  <button
                                    onClick={() => {
                                      console.log('✏️ Opening filter editor from no results message...');
                                      setShowFilterModal(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                    Adjust Filters
                                  </button>
                                  <button
                                    onClick={() => {
                                      console.log('🔄 Starting new search session from no results message...');
                                      setMessages([]);
                                      setShowResults(false);
                                      setCurrentMatches([]);
                                      setCurrentFilters(null);
                                      setCurrentSearchQuery(null);
                                      setRecentSearchContext(null);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Start New Search
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {message.type === 'assistant' && message.extractedFilters && !message.isProcessing && !message.noResultsFound && (
                              <div className="mt-6">
                                {/* Extracted Filters Display */}
                                <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-purple-600" />
                                    AI-Extracted Search Criteria
                                    <span className="ml-auto text-xs text-gray-500">Ready for search</span>
                                  </h4>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {message.extractedFilters.jobTitles?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Job Titles</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.jobTitles.slice(0, 3).map((title: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                                              {title}
                                            </span>
                                          ))}
                                          {message.extractedFilters.jobTitles.length > 3 && (
                                            <span 
                                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs cursor-pointer hover:bg-gray-200"
                                              title={message.extractedFilters.jobTitles.slice(3).join(', ')}
                                            >
                                              +{message.extractedFilters.jobTitles.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {message.extractedFilters.locations?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Locations</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.locations.map((location: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs font-medium">
                                              {location}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {message.extractedFilters.experienceRange?.min && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Experience</span>
                                        <div className="mt-1">
                                          <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-medium">
                                            {message.extractedFilters.experienceRange.min}+ years
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.skills?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Skills</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.skills.slice(0, 3).map((skill: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs font-medium">
                                              {skill}
                                            </span>
                                          ))}
                                          {message.extractedFilters.skills.length > 3 && (
                                            <span 
                                              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs cursor-pointer hover:bg-gray-200"
                                              title={message.extractedFilters.skills.slice(3).join(', ')}
                                            >
                                              +{message.extractedFilters.skills.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.industries?.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Industries</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {message.extractedFilters.industries.map((industry: string, index: number) => (
                                            <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md text-xs font-medium">
                                              {industry}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {message.extractedFilters.education && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Education</span>
                                        <div className="mt-1">
                                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium">
                                            {message.extractedFilters.education}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {message.showSearchButton && (
                                  <div className="flex gap-3">
                                    <button 
                                      onClick={() => {
                                        console.log('✏️ Opening filter editor...');
                                        setShowFilterModal(true);
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                                    >
                                      <Edit className="w-4 h-4" />
                                      Edit Filters
                                    </button>
                                    <button 
                                      onClick={() => {
                                        console.log('🚀 Starting streaming candidate search...');
                                        handleSearchCandidates(message.searchQuery!);
                                      }}
                                      disabled={isSearching}
                                      className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors"
                                    >
                                      {isSearching ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Searching...
                                        </>
                                      ) : (
                                        <>
                                          <Search className="w-4 h-4" />
                                          Search Candidates
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="relative">
                  {activeSearchMethod === 'jd' ? (
                    <div className="space-y-3">
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Paste your job description here and I'll extract the key requirements..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500 resize-none"
                        rows={4}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          <Upload className="w-4 h-4" />
                          Upload File
                        </button>
                        <button
                          type="submit"
                          disabled={!inputValue.trim() || isProcessing}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                        >
                          {isProcessing ? 'Analyzing...' : 'Extract Requirements'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={searchMethods.find(m => m.id === activeSearchMethod)?.placeholder}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        disabled={isProcessing}
                      />
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isProcessing}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Search className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  )}
                </form>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  <strong>Streaming Search:</strong> Real-time results with AI analysis
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Results View */
          <CandidateTable 
            matches={currentMatches} 
            onBack={() => setShowResults(false)}
            onEditFilters={() => setShowFilterModal(true)}
            currentFilters={currentFilters}
            currentProject={currentProject}
          />
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filters={currentFilters || {
            jobTitles: [],
            locations: [],
            experienceRange: {},
            skills: [],
            industries: [],
            education: null
          }}
          onSave={(filters) => {
            handleEditFilters(filters);
            setShowFilterModal(false);
          }}
        />
      )}
    </div>
  );
};

export default SearchView;