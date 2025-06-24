import React, { useState, useRef, useEffect, useContext } from 'react';
import { ArrowLeft, Send, Loader2, Sparkles, MessageSquare, User, Bot, Lightbulb, Target, Users, Palette, FileText, CheckCircle, Search } from 'lucide-react';
import { AuthContext } from '../AuthWrapper';
import { Project } from '../../lib/supabase';
import { AssistantMessage, CampaignDraft } from '../../types';
import { processUserInput, generateCampaignFromDraft } from '../../utils/campaignAssistantAI';
import { findCampaignExampleById } from '../../data/campaignExamples';
import { type EmailStep } from '../../utils/openai';

interface CampaignAssistantProps {
  onBack: () => void;
  onCampaignCreated: (campaignData: any, emailSteps: EmailStep[]) => void;
  currentProject?: Project | null;
  recentSearches?: string[];
}

const CampaignAssistant: React.FC<CampaignAssistantProps> = ({
  onBack,
  onCampaignCreated,
  currentProject,
  recentSearches = []
}) => {
  const { user } = useContext(AuthContext);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<Partial<CampaignDraft>>({
    companyName: 'HCA Healthcare',
    recruiterName: user?.full_name || 'Sarah Johnson',
    emailLength: 'concise' // Default to concise (60-80 words)
  });
  const [currentStep, setCurrentStep] = useState<'goal' | 'audience' | 'tone' | 'context' | 'review' | 'generate'>('goal');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation
  useEffect(() => {
    const welcomeMessage: AssistantMessage = {
      id: 'welcome',
      type: 'assistant',
      content: `Hi! I'm your AI Campaign Assistant. I'll help you create a personalized email campaign for ${currentProject?.name || 'your project'}. Let's start by understanding what you want to achieve.

What's the main goal for your campaign?`,
      timestamp: new Date(),
      suggestions: [
        "Build a talent community for healthcare professionals",
        "Nurture passive candidates with industry insights", 
        "Reengage inactive candidates with new opportunities",
        "Provide educational content to boost candidate skills"
      ]
    };
    
    setMessages([welcomeMessage]);
  }, [currentProject]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not processing
  useEffect(() => {
    if (!isProcessing && !isGenerating) {
      inputRef.current?.focus();
    }
  }, [isProcessing, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing || isGenerating) return;

    const userMessage: AssistantMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      console.log('🤖 Processing user input:', inputValue);
      
      const response = await processUserInput(inputValue, messages, campaignDraft, recentSearches);
      
      const assistantMessage: AssistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
        campaignDraft: response.campaignDraft
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Update campaign draft
      if (response.campaignDraft) {
        setCampaignDraft(response.campaignDraft);
      }
      
      // Update current step
      if (response.nextStep) {
        setCurrentStep(response.nextStep);
      }
      
      // Check if ready to generate
      if (response.isComplete && response.campaignDraft) {
        setTimeout(() => {
          handleGenerateCampaign(response.campaignDraft as CampaignDraft);
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ Error processing input:', error);
      
      const errorMessage: AssistantMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: "I apologize, but I encountered an error processing your request. Let's try again. Could you please rephrase your response?",
        timestamp: new Date(),
        suggestions: ["Let me try again", "Start over"]
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const handleGenerateCampaign = async (finalDraft: CampaignDraft) => {
    console.log('🎯 Generating campaign from final draft:', finalDraft);
    setIsGenerating(true);

    // Add generating message
    const generatingMessage: AssistantMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content: "Perfect! I have all the information I need. Let me generate your personalized campaign now...",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, generatingMessage]);

    try {
      const { campaignData, emailSteps } = await generateCampaignFromDraft(finalDraft);
      
      console.log('✅ Campaign generated successfully');
      
      const successMessage: AssistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `🎉 Your campaign "${campaignData.name}" has been generated successfully! It includes ${emailSteps.length} email steps designed to ${(finalDraft.goal || 'achieve your campaign objectives').toLowerCase()}. 

You'll now be taken to the campaign editor where you can review and customize each email before launching.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, successMessage]);
      
      // Wait a moment then proceed to campaign editor
      setTimeout(() => {
        onCampaignCreated(campaignData, emailSteps);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error generating campaign:', error);
      
      const errorMessage: AssistantMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: "I encountered an error while generating your campaign. Would you like to try again or proceed to manual campaign creation?",
        timestamp: new Date(),
        suggestions: ["Try again", "Manual creation", "Start over"]
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setIsGenerating(false);
    }
  };

  const getStepIcon = (step: string) => {
    const icons = {
      goal: Target,
      audience: Users,
      tone: Palette,
      context: FileText,
      review: CheckCircle,
      generate: Sparkles
    };
    return icons[step as keyof typeof icons] || MessageSquare;
  };

  const getStepLabel = (step: string) => {
    const labels = {
      goal: 'Campaign Goal',
      audience: 'Target Audience',
      tone: 'Tone & Length',
      context: 'Additional Context',
      review: 'Review & Confirm',
      generate: 'Generate Campaign'
    };
    return labels[step as keyof typeof labels] || 'Unknown';
  };

  const progressSteps = ['goal', 'audience', 'tone', 'context', 'review'];
  const currentStepIndex = progressSteps.indexOf(currentStep);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">AI Campaign Assistant</h1>
                <p className="text-sm text-gray-600">
                  Creating campaign for {currentProject?.name} • {getStepLabel(currentStep)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              Beta
            </span>
            {recentSearches.length > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                <Search className="w-3 h-3" />
                {recentSearches.length} Recent Searches
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">
              Step {Math.min(currentStepIndex + 1, progressSteps.length)} of {progressSteps.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(((currentStepIndex + 1) / progressSteps.length) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {progressSteps.map((step, index) => {
              const StepIcon = getStepIcon(step);
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted 
                      ? 'bg-green-100 text-green-600' 
                      : isCurrent 
                      ? 'bg-purple-100 text-purple-600' 
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs mt-1 ${
                    isCompleted || isCurrent ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {getStepLabel(step).split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-4">
              <div className="flex-shrink-0">
                {message.type === 'user' ? (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <div className={`rounded-2xl p-4 ${
                  message.type === 'user' 
                    ? 'bg-blue-100 text-blue-900 ml-8' 
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  
                  {/* Campaign Draft Preview */}
                  {message.campaignDraft && Object.keys(message.campaignDraft).length > 1 && (
                    <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Campaign Draft
                      </h4>
                      <div className="space-y-2 text-sm">
                        {message.campaignDraft.goal && (
                          <div>
                            <span className="font-medium text-purple-700">Goal:</span>
                            <span className="text-purple-600 ml-2">{message.campaignDraft.goal}</span>
                          </div>
                        )}
                        {message.campaignDraft.targetAudience && (
                          <div>
                            <span className="font-medium text-purple-700">Audience:</span>
                            <span className="text-purple-600 ml-2">{message.campaignDraft.targetAudience}</span>
                          </div>
                        )}
                        {message.campaignDraft.tone && (
                          <div>
                            <span className="font-medium text-purple-700">Tone:</span>
                            <span className="text-purple-600 ml-2">{message.campaignDraft.tone}</span>
                          </div>
                        )}
                        {message.campaignDraft.emailLength && (
                          <div>
                            <span className="font-medium text-purple-700">Email Length:</span>
                            <span className="text-purple-600 ml-2">
                              {message.campaignDraft.emailLength === 'short' ? 'Short (30-50 words)' :
                               message.campaignDraft.emailLength === 'concise' ? 'Concise (60-80 words)' :
                               message.campaignDraft.emailLength === 'medium' ? 'Medium (100-120 words)' :
                               'Long (150+ words)'}
                            </span>
                          </div>
                        )}
                        {message.campaignDraft.type && (
                          <div>
                            <span className="font-medium text-purple-700">Type:</span>
                            <span className="text-purple-600 ml-2">{message.campaignDraft.type}</span>
                          </div>
                        )}
                        
                        {/* Show detailed campaign example information if matchedExampleId exists */}
                        {message.campaignDraft.matchedExampleId && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            {(() => {
                              const matchedExample = findCampaignExampleById(message.campaignDraft.matchedExampleId!);
                              if (!matchedExample) return null;
                              
                              return (
                                <div className="space-y-2">
                                  <div>
                                    <span className="font-medium text-purple-700">Campaign Structure:</span>
                                    <div className="text-purple-600 ml-2 text-xs">
                                      <div>{matchedExample.sequenceAndExamples.description}</div>
                                      <div className="mt-1">
                                        <strong>{matchedExample.sequenceAndExamples.steps} steps</strong> over <strong>{matchedExample.sequenceAndExamples.duration} days</strong>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium text-purple-700">Email Sequence:</span>
                                    <div className="text-purple-600 ml-2 text-xs">
                                      {matchedExample.sequenceAndExamples.examples.map((example, index) => (
                                        <div key={index} className="flex items-center gap-1 mt-1">
                                          <span className="w-4 h-4 bg-purple-200 text-purple-700 rounded-full text-xs flex items-center justify-center font-medium">
                                            {index + 1}
                                          </span>
                                          <span>{example}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <span className="font-medium text-purple-700">Content Sources:</span>
                                    <div className="text-purple-600 ml-2 text-xs">
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {matchedExample.collateralToUse.map((collateral, index) => (
                                          <span key={index} className="px-2 py-0.5 bg-purple-200 text-purple-700 rounded-full text-xs">
                                            {collateral}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Quick suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Processing Indicator */}
          {(isProcessing || isGenerating) && (
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
              <div className="flex-1">
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-gray-600">
                      {isGenerating ? 'Generating your campaign...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      {!isGenerating && (
        <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your response..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isProcessing}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI Assistant will help you create a personalized campaign based on proven templates
              {recentSearches.length > 0 && ` • Using insights from your ${recentSearches.length} recent searches`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignAssistant;