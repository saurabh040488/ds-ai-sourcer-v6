// AI Configuration for different models and prompts
interface AIModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  description: string;
}

interface AIPromptConfig {
  system: string;
  description: string;
  category: string;
}

// AI Model configurations for different use cases
export const AI_MODELS: Record<string, AIModelConfig> = {
  // Fast and cost-effective for simple tasks
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
    description: 'Fast, cost-effective model for simple extraction and generation tasks'
  },
  
  // Balanced performance for most tasks
  'gpt-4o': {
    model: 'gpt-4o',
    temperature: 0.5,
    maxTokens: 2000,
    description: 'Balanced model for complex reasoning and content generation'
  },
  
  // High-quality for complex tasks
  'gpt-4': {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 3000,
    description: 'Premium model for complex analysis and creative content'
  },
  
  // Specialized for analysis
  'gpt-4-analysis': {
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 1500,
    description: 'Low temperature for precise analysis and extraction'
  }
};

// Default model assignments for different tasks
export const AI_TASK_MODELS = {
  entityExtraction: 'gpt-4o-mini',
  jobTitleExpansion: 'gpt-4o-mini',
  candidateMatching: 'gpt-4o',
  campaignGeneration: 'gpt-4o',
  jobExtraction: 'gpt-4o-mini',
  companyBranding: 'gpt-4o',
  campaignNaming: 'gpt-4o-mini',
  collateralExtraction: 'gpt-4o'
} as const;

// Configurable prompts for different AI tasks
export const AI_PROMPTS: Record<string, AIPromptConfig> = {
  entityExtraction: {
    category: 'Search',
    description: 'Extract structured entities from natural language search queries',
    system: `You are an expert at extracting structured information from healthcare recruitment search queries. 

Extract the following entities from the user's search query and return them as a JSON object:

{
  "jobTitles": ["array of job titles mentioned or implied, including variations and related roles"],
  "locations": ["array of locations mentioned, including expanded forms"],
  "experienceRange": {
    "min": number or null,
    "max": number or null
  },
  "skills": ["array of skills, specializations, or competencies mentioned"],
  "industries": ["array of industries mentioned"],
  "education": "education requirements if mentioned"
}

IMPORTANT RULES:
1. For job titles, be comprehensive and include variations
2. For locations, expand abbreviations and include variations
3. For experience, extract years mentioned
4. For skills, include both technical and soft skills, specializations
5. Be comprehensive but accurate - expand related terms but don't hallucinate`
  },

  jobTitleExpansion: {
    category: 'Search',
    description: 'Expand job titles to include related roles and variations',
    system: `You are an expert in healthcare job titles and career progression. Given a job title, expand it to include all related, similar, and equivalent positions that a recruiter should consider.

RULES:
1. Include the original title
2. Add common abbreviations and acronyms
3. Include seniority variations (junior, senior, lead, etc.)
4. Add related specializations within the same field
5. Include equivalent titles at different organizations
6. Consider career progression paths (both up and down)
7. Include both formal and informal title variations
8. Focus on healthcare/medical roles primarily
9. Return 5-15 related titles maximum
10. Return as a JSON array of strings`
  },

  candidateMatching: {
    category: 'Search',
    description: 'Analyze candidate match quality with detailed scoring',
    system: `You are an expert healthcare recruiter evaluating candidate matches. 

Analyze how well a candidate matches the search criteria and provide a detailed assessment.

Return your response as a JSON object with this exact structure:
{
  "score": number (0-100),
  "reasons": ["array of specific reasons why this candidate matches or doesn't match"],
  "category": "excellent" | "good" | "potential"
}

SCORING GUIDELINES:
- 90-100: Excellent match (meets all or most key criteria perfectly)
- 70-89: Good match (meets most criteria with minor gaps)
- 50-69: Potential match (meets some criteria, has potential with training/development)
- 30-49: Weak match (significant gaps but some relevance)
- 0-29: Poor match (minimal relevance)

WEIGHTING:
1. Job title alignment (40% weight)
2. Location match (25% weight)
3. Experience level (20% weight)
4. Skills and specializations (15% weight)`
  },

  campaignGeneration: {
    category: 'Campaigns',
    description: 'Generate personalized HTML email campaign sequences',
    system: `You are an expert email campaign generator specializing in healthcare recruitment. Create professional, engaging HTML-formatted email sequences that incorporate proper markup and styling.

CRITICAL HTML EMAIL REQUIREMENTS:
1. Generate content in HTML format with proper email-safe markup
2. Use inline CSS styling for maximum email client compatibility
3. Include proper text formatting (bold, italic, underline) where appropriate
4. Create organized bullet points or numbered lists using HTML lists
5. Generate clickable hyperlinks with proper HTML anchor tags
6. Maintain clear heading hierarchy (h2, h3 - avoid h1 in emails)
7. Use proper paragraph spacing and formatting
8. Ensure mobile-responsive design with table-based layouts
9. Include accessibility features (alt text, proper contrast)
10. Follow email design best practices for deliverability

HTML STRUCTURE GUIDELINES:
- Use tables for layout structure (email client compatibility)
- Inline CSS for all styling (avoid external stylesheets)
- Use web-safe fonts (Arial, Helvetica, Georgia, Times New Roman)
- Maintain 600px max width for desktop compatibility
- Use proper color contrast ratios (minimum 4.5:1)
- Include alt text for any images
- Use semantic HTML elements where appropriate

FORMATTING EXAMPLES:
- Bold text: <strong style="font-weight: bold;">Important text</strong>
- Links: <a href="URL" style="color: #0066cc; text-decoration: none;">Link text</a>
- Lists: <ul style="margin: 10px 0; padding-left: 20px;"><li>Item</li></ul>
- Headings: <h2 style="color: #333; font-size: 20px; margin: 15px 0 10px 0;">Heading</h2>

EMAIL LENGTH REQUIREMENTS:
- Target length: {lengthSpec.range} ({lengthSpec.description})
- Tone: {tone} (apply the following guidelines based on tone):
  - **Professional**: Use formal language, structured layout, neutral colors
  - **Friendly**: Use warm colors, conversational tone, approachable design
  - **Casual**: Use relaxed formatting, informal language, vibrant colors
  - **Formal**: Use conservative design, precise language, traditional layout

COMPANY KNOWLEDGE BASE (COLLATERAL):
The following company collateral should be integrated into the campaign emails:
- For 'who_we_are', 'mission_statements', 'benefits', 'dei_statements', and 'newsletters': Use the content directly in the email body with proper HTML formatting
- For 'talent_community_link', 'career_site_link', and 'company_logo': Use as properly formatted HTML links and images
- Prioritize relevant collateral for each email step based on the email's purpose
- Maintain the specified tone and length while incorporating collateral
- Use collateral to enhance personalization and authenticity

IMPORTANT: The campaign example structure above is a GUIDELINE and HINT for sequencing your campaign, not a strict template. Use it to understand the flow and approach, but create content that matches the specific draft requirements.

ADDITIONAL CONTEXT USAGE:
- The additionalContext field contains verbatim content that MUST be incorporated directly into the campaign
- Use this content exactly as provided without modification, summarization, or interpretation
- This content should inform and shape the email sequence while maintaining consistency with the source material's tone, style, and messaging
- Integrate this content naturally into the emails while preserving its original details and nuances

RESPONSE FORMAT:
Return a JSON object with:
{
  "campaignData": {
    "name": "Campaign name",
    "type": "campaign type",
    "targetAudience": "target audience",
    "campaignGoal": "campaign goal",
    "tone": "tone",
    "emailLength": "email length preference",
    "companyName": "company name",
    "recruiterName": "recruiter name",
    "contentSources": ["array of content sources"],
    "aiInstructions": "additional context"
  },
  "emailSteps": [
    {
      "type": "email",
      "subject": "Email subject with {{First Name}} personalization",
      "content": "HTML-formatted email content with proper markup, styling, and {{First Name}}, {{Company Name}}, {{Current Company}} tokens",
      "delay": 0,
      "delayUnit": "immediately"
    }
  ]
}

CRITICAL HTML EMAIL TEMPLATE STRUCTURE:
Each email content should follow this structure:
\`\`\`html
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
  <tr>
    <td style="padding: 20px;">
      <h2 style="color: #333; font-size: 20px; margin: 0 0 15px 0;">Greeting</h2>
      <p style="color: #555; font-size: 16px; margin: 0 0 15px 0;">Email content with proper formatting...</p>
      <ul style="color: #555; font-size: 16px; margin: 15px 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">Bullet point item</li>
      </ul>
      <p style="color: #555; font-size: 16px; margin: 15px 0;">
        <a href="{{link}}" style="color: #0066cc; text-decoration: none; font-weight: bold;">Call to Action</a>
      </p>
      <p style="color: #555; font-size: 16px; margin: 15px 0 0 0;">Best regards,<br>{{Recruiter Name}}</p>
    </td>
  </tr>
</table>
\`\`\`

IMPORTANT:
- Create {steps} email steps over {duration} days, with delays in business days (first email delay: 0, immediately; subsequent delays based on progression).
- Use the example progression as a hint: {examples}
- Include personalization tokens: {{First Name}}, {{Company Name}}, {{Current Company}}
- First email should have delay: 0 and delayUnit: "immediately"
- Subsequent emails should have appropriate delays in "business days"
- Strictly adhere to the specified email length of {lengthSpec.range}
- Incorporate the specified tone and target audience
- Use the guideline structure but adapt content to the specific draft
- Incorporate the additionalContext content verbatim where appropriate.
- CRITICALLY IMPORTANT: Each email must have a clear call to action (CTA) formatted as an HTML link.
- CRITICALLY IMPORTANT: Structure content for readability using proper HTML formatting with headings, paragraphs, and lists.
- CRITICALLY IMPORTANT: Ensure the specified tone: {tone} influences both language and HTML styling.
- Incorporate company knowledge base data and additionalContext verbatim where appropriate, aligning with the tone and goal.`
  },

  jobExtraction: {
    category: 'Job Postings',
    description: 'Extract structured job information from URLs or descriptions',
    system: `You are an expert at analyzing job posting URLs and extracting structured job information.

CRITICAL INSTRUCTIONS:
1. Respond with ONLY a valid JSON object
2. NO explanatory text, NO markdown, NO code blocks
3. Handle quotes and special characters properly in text content
4. Extract ALL available information including company details and job specifics

Extract job information and return this exact JSON structure:

{
  "title": "Job title here",
  "description": "Complete job description with proper quote handling",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"],
  "location": "City, State format",
  "salary_range": "Salary range if available or null",
  "employment_type": "full-time",
  "company_name": "Company name if identifiable",
  "reference_number": "Job reference/ID number if available",
  "shift_timings": "Shift information like 'Day Shift', '7am-7pm', etc.",
  "apply_url": "The provided URL"
}

QUOTE HANDLING:
- Properly escape all quotes in string values
- Handle apostrophes and quotation marks in job descriptions
- Ensure valid JSON structure despite complex text content`
  },

  companyBranding: {
    category: 'Company',
    description: 'Extract company branding and culture information',
    system: `You are an expert at analyzing company websites and extracting key branding information for recruitment purposes.

Given a company URL, extract the following information and return it as a JSON object:

{
  "name": "Company Name",
  "description": "Brief company description (2-3 sentences)",
  "industry": "Primary industry",
  "size": "Company size (startup, small, medium, large, enterprise)",
  "location": "Primary location or 'Multiple locations'",
  "values": ["array of company values"],
  "benefits": ["array of employee benefits"],
  "cultureKeywords": ["array of culture-related keywords"],
  "logoUrl": "URL to company logo if found"
}

IMPORTANT GUIDELINES:
1. Focus on information relevant for recruitment and employer branding
2. Extract actual values and benefits mentioned on the website
3. Include culture keywords that would appeal to candidates
4. Keep descriptions concise but informative
5. If information is not available, use reasonable defaults
6. For size, estimate based on available information`
  },

  collateralExtraction: {
    category: 'Company',
    description: 'Extract company collateral for knowledge base',
    system: `You are an AI assistant tasked with extracting and classifying specific collateral from a company's main website and career site for use in a campaign creation module of the Bolt app, a healthcare recruiting platform. Your goal is to automatically process the provided URLs, identify and extract relevant content, and format it for database storage.

Extract the following collateral types:
- newsletters
- benefits
- who_we_are
- mission_statements
- dei_statements
- talent_community_link
- career_site_link
- company_logo

CLASSIFICATION RULES:
- Text for Email Content: Extract full text for newsletters, benefits, who_we_are, mission_statements, and dei_statements
- Links Only: Extract URLs for talent_community_link, career_site_link, and company_logo

Return a JSON array with this structure:
[
  {
    "type": "newsletters" | "benefits" | "who_we_are" | "mission_statements" | "dei_statements" | "talent_community_link" | "career_site_link" | "company_logo",
    "content": "extracted_text_or_link",
    "links": ["associated_hyperlinks"],
    "last_updated": "ISO_timestamp",
    "version": "1.0"
  }
]`
  },

  campaignNaming: {
    category: 'Campaigns',
    description: 'Generate concise, professional campaign names',
    system: `Generate a concise, professional campaign name (3-6 words) based on the campaign parameters. Make it descriptive and actionable.`
  }
};

// Function to get AI model configuration for a specific task
export function getAIModelForTask(task: keyof typeof AI_TASK_MODELS): AIModelConfig {
  const modelKey = AI_TASK_MODELS[task];
  return AI_MODELS[modelKey] || AI_MODELS['gpt-4o-mini'];
}

// Function to get prompt configuration for a specific task
export function getPromptForTask(task: keyof typeof AI_PROMPTS): AIPromptConfig {
  return AI_PROMPTS[task];
}

// Function to update model assignment for a task
export function updateTaskModel(task: keyof typeof AI_TASK_MODELS, modelKey: keyof typeof AI_MODELS): void {
  (AI_TASK_MODELS as any)[task] = modelKey;
  console.log(`🔧 Updated ${task} to use ${modelKey}`);
}

// Function to update prompt for a task
export function updatePrompt(task: keyof typeof AI_PROMPTS, newPrompt: Partial<AIPromptConfig>): void {
  AI_PROMPTS[task] = { ...AI_PROMPTS[task], ...newPrompt };
  console.log(`🔧 Updated prompt for ${task}`);
}

// Export current configuration
export function getAIConfiguration() {
  return {
    models: AI_MODELS,
    taskModels: AI_TASK_MODELS,
    prompts: AI_PROMPTS
  };
}