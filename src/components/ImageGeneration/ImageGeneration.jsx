// src/components/ImageGeneration/ImageGeneration.jsx - Enhanced with advanced features

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import PromptInput from '../../components/ImageGeneration/PromptInput';
import StyleSelector from '../../components/ImageGeneration/StyleSelector';
import ParamControls from '../../components/ImageGeneration/ParamControls';
import PreviewPanel from '../../components/ImageGeneration/PreviewPanel';
import HistoryPanel from '../../components/ImageGeneration/HistoryPanel';
import BatchGeneration from '../../components/ImageGeneration/BatchGeneration';
import AdvancedOptions from '../../components/ImageGeneration/AdvancedOptions';
import ModelSelector from '../../components/ImageGeneration/ModelSelector';
import PromptSuggestions from '../../components/ImageGeneration/PromptSuggestions';
import LoadingState from '../../components/Common/LoadingState';
import ErrorState from '../../components/Common/ErrorState';
import EmptyState from '../../components/Common/EmptyState';
import { generateImage, getImageHistory, getStyles } from '../../services/imageGeneration';
import { saveToGallery } from '../../services/mediaService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Download,
  Share2,
  RefreshCw,
  Settings,
  Image as ImageIcon,
  Grid3x3,
  Palette,
  Layers,
  Shield,
  Rocket,
  Wand2,
  Brain,
  Clock,
  TrendingUp,
  ZapOff,
  Star,
  Crown
} from 'lucide-react';
import './ImageGeneration.css';

// Enhanced validation schema
const schema = yup.object({
  prompt: yup.string()
    .required('Prompt is required')
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must be less than 2000 characters')
    .test(
      'no-inappropriate-content',
      'Prompt contains inappropriate content',
      (value) => {
        if (!value) return true;
        const inappropriateWords = ['hate', 'violence', 'explicit'];
        return !inappropriateWords.some(word => 
          value.toLowerCase().includes(word)
        );
      }
    ),
  negativePrompt: yup.string().max(1000, 'Negative prompt too long'),
  width: yup.number().min(256).max(4096).default(1024),
  height: yup.number().min(256).max(4096).default(1024),
  steps: yup.number().min(10).max(200).default(50),
  guidance: yup.number().min(1).max(30).default(7.5),
  seed: yup.number().min(0).max(9999999999),
  style: yup.string().default('realistic'),
  model: yup.string().default('stable-diffusion-xl'),
  batchCount: yup.number().min(1).max(20).default(1),
  quality: yup.string().oneOf(['standard', 'premium', 'ultra']).default('standard'),
  aspectRatio: yup.string().oneOf(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1'),
});

const ImageGeneration = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { socket, isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const previewRef = useRef(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showHistory, setShowHistory] = useState(!isMobile);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(true);
  const [activeTab, setActiveTab] = useState('generate');
  const [generationTime, setGenerationTime] = useState(0);
  const [totalGenerations, setTotalGenerations] = useState(0);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      prompt: '',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      steps: 50,
      guidance: 7.5,
      seed: null,
      style: 'realistic',
      model: 'stable-diffusion-xl',
      batchCount: 1,
      quality: 'standard',
      aspectRatio: '1:1',
    },
    mode: 'onChange'
  });

  // Watch form values
  const formValues = watch();

  // Queries
  const { data: styles, isLoading: stylesLoading } = useQuery(
    'image-styles',
    getStyles,
    { 
      staleTime: Infinity,
      onError: (error) => {
        showNotification('error', `Failed to load styles: ${error.message}`);
      }
    }
  );

  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useQuery(
    ['image-history', user?.id],
    () => getImageHistory(user?.id),
    { 
      enabled: !!user?.id,
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        setTotalGenerations(data?.total || 0);
      }
    }
  );

  // Mutations
  const generateMutation = useMutation(generateImage, {
    onMutate: () => {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationTime(Date.now());
    },
    onSuccess: (data) => {
      setGeneratedImages(prev => [data, ...prev.slice(0, 9)]);
      setSelectedImage(data);
      queryClient.invalidateQueries(['image-history', user?.id]);
      showNotification('success', 'Image generated successfully!', {
        icon: '🎨',
        duration: 3000
      });
      
      // Auto-save to gallery for premium users
      if (user?.subscription?.tier !== 'free') {
        saveToGalleryMutation.mutate(data);
      }
      
      // Track generation time
      const timeTaken = (Date.now() - generationTime) / 1000;
      console.log(`Generation completed in ${timeTaken}s`);
    },
    onError: (error) => {
      showNotification('error', `Generation failed: ${error.message}`, {
        icon: '❌',
        duration: 5000
      });
    },
    onSettled: () => {
      setIsGenerating(false);
      setGenerationProgress(100);
    }
  });

  const saveToGalleryMutation = useMutation(saveToGallery, {
    onSuccess: () => {
      showNotification('success', 'Saved to gallery', {
        icon: '💾',
        duration: 2000
      });
    },
    onError: (error) => {
      showNotification('error', `Failed to save: ${error.message}`);
    }
  });

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleGenerationProgress = (data) => {
      setGenerationProgress(data.progress);
      
      // Calculate estimated time remaining
      if (data.progress > 0) {
        const elapsed = (Date.now() - generationTime) / 1000;
        const estimatedTotal = elapsed / (data.progress / 100);
        const remaining = estimatedTotal - elapsed;
        console.log(`Estimated time remaining: ${remaining.toFixed(1)}s`);
      }
    };

    const handleImageGenerated = (data) => {
      setGeneratedImages(prev => [data, ...prev.slice(0, 9)]);
      setSelectedImage(data);
      setIsGenerating(false);
      setGenerationProgress(100);
      showNotification('success', 'Image ready!', {
        icon: '✨',
        duration: 2000
      });
    };

    const handleGenerationError = (data) => {
      showNotification('error', `Generation error: ${data.error}`, {
        icon: '⚠️',
        duration: 5000
      });
      setIsGenerating(false);
    };

    socket.on('generation_progress', handleGenerationProgress);
    socket.on('image_generated', handleImageGenerated);
    socket.on('generation_error', handleGenerationError);

    return () => {
      socket.off('generation_progress', handleGenerationProgress);
      socket.off('image_generated', handleImageGenerated);
      socket.off('generation_error', handleGenerationError);
    };
  }, [socket, isConnected, showNotification, generationTime]);

  // Form submission
  const onSubmit = async (data) => {
    if (!user) {
      showNotification('error', 'Please login to generate images');
      return;
    }

    // Check subscription limits
    if (user.subscription?.tier === 'free') {
      const todayCount = history?.todayCount || 0;
      if (todayCount >= 10) {
        showNotification('error', 'Free tier limit reached. Upgrade to generate more images.', {
          action: {
            label: 'Upgrade',
            onClick: () => navigate('/subscription')
          }
        });
        return;
      }
    }

    // Check credits for premium users
    if (user.subscription?.tier === 'premium' && user.credits < 1) {
      showNotification('error', 'Insufficient credits. Please purchase more credits.');
      return;
    }

    generateMutation.mutate({
      ...data,
      userId: user.id,
      apiKey: user.apiKey,
      timestamp: Date.now()
    });
  };

  // Handle generation
  const handleGenerate = useCallback(() => {
    handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  // Handle batch generation
  const handleBatchGenerate = useCallback((prompts) => {
    if (!user) return;
    
    if (user.subscription?.tier === 'free' && prompts.length > 3) {
      showNotification('error', 'Free users can only generate 3 images at once');
      return;
    }

    prompts.forEach((prompt, index) => {
      setTimeout(() => {
        generateMutation.mutate({
          prompt,
          ...formValues,
          userId: user.id,
          apiKey: user.apiKey
        });
      }, index * 2000); // Stagger requests
    });
  }, [user, formValues, generateMutation, showNotification]);

  // Handle random seed
  const handleRandomSeed = useCallback(() => {
    const seed = Math.floor(Math.random() * 9999999999);
    setValue('seed', seed, { shouldValidate: true });
  }, [setValue]);

  // Handle image selection
  const handleSelectImage = useCallback((image) => {
    setSelectedImage(image);
    if (previewRef.current && isMobile) {
      previewRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isMobile]);

  // Handle download
  const handleDownload = useCallback((image) => {
    if (!image) return;
    
    try {
      const link = document.createElement('a');
      link.href = `${process.env.REACT_APP_CDN_URL}/images/${image.id}.png`;
      link.download = `changex-neurix-${Date.now()}.png`;
      link.click();
      
      showNotification('success', 'Image downloaded', {
        icon: '💾',
        duration: 2000
      });
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('error', 'Download failed');
    }
  }, [showNotification]);

  // Handle share
  const handleShare = useCallback(async (image) => {
    if (!image) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Changex Neurix Generated Image',
          text: `Check out this image I generated: ${image.prompt}`,
          url: `${window.location.origin}/share/image/${image.id}`,
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}/share/image/${image.id}`
        );
        showNotification('success', 'Link copied to clipboard', {
          icon: '📋',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      if (error.name !== 'AbortError') {
        showNotification('error', 'Sharing failed');
      }
    }
  }, [showNotification]);

  // Handle regenerate
  const handleRegenerate = useCallback(() => {
    if (!selectedImage) return;

    setValue('prompt', selectedImage.prompt);
    setValue('negativePrompt', selectedImage.negativePrompt || '');
    setValue('width', selectedImage.width);
    setValue('height', selectedImage.height);
    setValue('steps', selectedImage.steps);
    setValue('guidance', selectedImage.guidance);
    setValue('seed', selectedImage.seed);
    setValue('style', selectedImage.style);
    setValue('model', selectedImage.model);

    handleGenerate();
  }, [selectedImage, setValue, handleGenerate]);

  // Quick presets
  const quickPresets = useMemo(() => [
    {
      name: 'Portrait',
      icon: '👤',
      color: 'purple',
      preset: {
        width: 1024,
        height: 1024,
        steps: 60,
        guidance: 8.0,
        style: 'photorealistic',
        negativePrompt: 'blurry, distorted, ugly, deformed, bad anatomy',
        aspectRatio: '1:1'
      }
    },
    {
      name: 'Landscape',
      icon: '🏞️',
      color: 'green',
      preset: {
        width: 1920,
        height: 1080,
        steps: 70,
        guidance: 7.5,
        style: 'realistic',
        negativePrompt: 'person, human, building, text, watermark',
        aspectRatio: '16:9'
      }
    },
    {
      name: 'Anime',
      icon: '🎨',
      color: 'pink',
      preset: {
        width: 1024,
        height: 1024,
        steps: 50,
        guidance: 8.5,
        style: 'anime',
        negativePrompt: 'realistic, photo, 3d, blurry',
        aspectRatio: '1:1'
      }
    },
    {
      name: 'Abstract',
      icon: '🟣',
      color: 'indigo',
      preset: {
        width: 2048,
        height: 2048,
        steps: 80,
        guidance: 9.0,
        style: 'abstract',
        negativePrompt: 'text, words, letters, signature',
        aspectRatio: '1:1'
      }
    },
    {
      name: 'Product',
      icon: '📱',
      color: 'blue',
      preset: {
        width: 1080,
        height: 1080,
        steps: 65,
        guidance: 8.0,
        style: 'product',
        negativePrompt: 'background, messy, cluttered, low quality',
        aspectRatio: '1:1'
      }
    }
  ], []);

  // Aspect ratio options
  const aspectRatios = [
    { value: '1:1', label: 'Square', icon: '⬜' },
    { value: '16:9', label: 'Widescreen', icon: '📺' },
    { value: '9:16', label: 'Portrait', icon: '📱' },
    { value: '4:3', label: 'Standard', icon: '📷' },
    { value: '3:4', label: 'Vertical', icon: '📐' }
  ];

  // Quality options
  const qualityOptions = [
    { value: 'standard', label: 'Standard', icon: '⭐', credits: 1 },
    { value: 'premium', label: 'Premium', icon: '⭐⭐', credits: 2 },
    { value: 'ultra', label: 'Ultra', icon: '⭐⭐⭐', credits: 3 }
  ];

  // Loading states
  if (stylesLoading) {
    return (
      <DashboardLayout title="Image Generation">
        <LoadingState message="Loading styles..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Image Generation"
      subtitle="Create stunning images with AI"
      actions={[
        {
          icon: <Grid3x3 size={20} />,
          label: 'Gallery',
          onClick: () => navigate('/image-gallery'),
          variant: 'outline'
        },
        {
          icon: <Palette size={20} />,
          label: 'Styles',
          onClick: () => navigate('/styles'),
          variant: 'outline'
        },
        {
          icon: <Crown size={20} />,
          label: 'Upgrade',
          onClick: () => navigate('/subscription'),
          variant: 'primary',
          visible: user?.subscription?.tier === 'free'
        }
      ]}
      stats={[
        {
          label: 'Today',
          value: history?.todayCount || 0,
          max: user?.subscription?.dailyLimit || 10,
          icon: <Clock size={16} />
        },
        {
          label: 'Total',
          value: totalGenerations,
          icon: <TrendingUp size={16} />
        },
        {
          label: 'Credits',
          value: user?.credits || 0,
          icon: <Zap size={16} />
        }
      ]}
    >
      <div className="image-generation-page">
        {/* Tabs */}
        <div className="generation-tabs">
          <button
            className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            <Sparkles size={18} />
            Generate
          </button>
          <button
            className={`tab-btn ${activeTab === 'batch' ? 'active' : ''}`}
            onClick={() => setActiveTab('batch')}
          >
            <Layers size={18} />
            Batch
          </button>
          <button
            className={`tab-btn ${activeTab === 'enhance' ? 'active' : ''}`}
            onClick={() => setActiveTab('enhance')}
          >
            <Wand2 size={18} />
            Enhance
          </button>
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Brain size={18} />
            History
          </button>
        </div>

        <div className="generation-container">
          {/* Left Panel - Controls */}
          <div className="controls-panel">
            <motion.div
              className="controls-card glass-card"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="controls-header">
                <div className="header-title">
                  <Sparkles size={24} />
                  <h3>Generate Image</h3>
                  {user?.subscription?.tier !== 'free' && (
                    <span className="premium-badge">
                      <Crown size={14} />
                      {user.subscription.tier}
                    </span>
                  )}
                </div>
                <div className="header-actions">
                  <button
                    className={`btn-icon ${showAdvanced ? 'active' : ''}`}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    title="Toggle advanced options"
                  >
                    <Settings size={18} />
                    {showAdvanced ? 'Simple' : 'Advanced'}
                  </button>
                  <button
                    className="btn-icon"
                    onClick={handleRandomSeed}
                    title="Random seed"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Prompt Input with Suggestions */}
                <PromptInput
                  register={register}
                  errors={errors}
                  isGenerating={isGenerating}
                  showSuggestions={showPromptSuggestions}
                  onToggleSuggestions={() => setShowPromptSuggestions(!showPromptSuggestions)}
                />

                {/* Prompt Suggestions */}
                {showPromptSuggestions && (
                  <PromptSuggestions
                    onSelect={(prompt) => setValue('prompt', prompt)}
                  />
                )}

                {/* Quick Presets */}
                <div className="quick-presets">
                  <div className="presets-header">
                    <h4>Quick Presets</h4>
                    <span className="badge">{quickPresets.length}</span>
                  </div>
                  <div className="presets-grid">
                    {quickPresets.map((preset, index) => (
                      <motion.button
                        key={index}
                        className={`preset-btn ${preset.color}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          Object.entries(preset.preset).forEach(([key, value]) => {
                            setValue(key, value, { shouldValidate: true });
                          });
                        }}
                      >
                        <span className="preset-icon">{preset.icon}</span>
                        <span className="preset-name">{preset.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Style Selector */}
                <StyleSelector
                  styles={styles}
                  selected={formValues.style}
                  onSelect={(style) => setValue('style', style, { shouldValidate: true })}
                />

                {/* Model Selector */}
                <ModelSelector
                  selected={formValues.model}
                  onSelect={(model) => setValue('model', model, { shouldValidate: true })}
                  userTier={user?.subscription?.tier}
                />

                {/* Aspect Ratio Selector */}
                <div className="aspect-ratio-selector">
                  <h4>Aspect Ratio</h4>
                  <div className="ratio-grid">
                    {aspectRatios.map((ratio) => (
                      <button
                        key={ratio.value}
                        className={`ratio-btn ${formValues.aspectRatio === ratio.value ? 'active' : ''}`}
                        onClick={() => setValue('aspectRatio', ratio.value, { shouldValidate: true })}
                        type="button"
                      >
                        <span className="ratio-icon">{ratio.icon}</span>
                        <span className="ratio-label">{ratio.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality Selector */}
                <div className="quality-selector">
                  <h4>Quality</h4>
                  <div className="quality-grid">
                    {qualityOptions.map((quality) => (
                      <button
                        key={quality.value}
                        className={`quality-btn ${formValues.quality === quality.value ? 'active' : ''}`}
                        onClick={() => setValue('quality', quality.value, { shouldValidate: true })}
                        type="button"
                        disabled={user?.credits < quality.credits}
                        title={user?.credits < quality.credits ? 'Insufficient credits' : ''}
                      >
                        <span className="quality-icon">{quality.icon}</span>
                        <span className="quality-label">{quality.label}</span>
                        <span className="quality-credits">{quality.credits} credit{quality.credits !== 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parameter Controls */}
                {showAdvanced ? (
                  <AdvancedOptions
                    register={register}
                    errors={errors}
                    onRandomSeed={handleRandomSeed}
                    formValues={formValues}
                    setValue={setValue}
                  />
                ) : (
                  <ParamControls
                    formValues={formValues}
                    setValue={setValue}
                    errors={errors}
                  />
                )}

                {/* Safety & Privacy */}
                <div className="safety-section">
                  <div className="safety-header">
                    <Shield size={18} />
                    <h4>Safety & Privacy</h4>
                  </div>
                  <div className="safety-options">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        {...register('safeMode')}
                        defaultChecked
                      />
                      <span>Safe mode (filter inappropriate content)</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        {...register('privateMode')}
                      />
                      <span>Private mode (don't save to public gallery)</span>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                  <motion.button
                    type="button"
                    className="btn-primary btn-generate"
                    onClick={handleGenerate}
                    disabled={isGenerating || !isValid}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        Generating... {generationProgress}%
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Generate Image
                      </>
                    )}
                  </motion.button>
                  
                  <div className="secondary-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowBatch(true)}
                      disabled={isGenerating}
                    >
                      <Layers size={16} />
                      Batch Generate
                    </button>
                    
                    {selectedImage && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                      >
                        <RefreshCw size={16} />
                        Regenerate
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {isGenerating && (
                  <div className="generation-progress">
                    <div className="progress-header">
                      <span>Generating...</span>
                      <span>{generationProgress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                    <div className="progress-hint">
                      {generationProgress < 30 && 'Initializing model...'}
                      {generationProgress >= 30 && generationProgress < 70 && 'Generating image...'}
                      {generationProgress >= 70 && 'Finalizing...'}
                    </div>
                  </div>
                )}
              </form>
            </motion.div>

            {/* Batch Generation Modal */}
            <AnimatePresence>
              {showBatch && (
                <BatchGeneration
                  onGenerate={handleBatchGenerate}
                  onClose={() => setShowBatch(false)}
                  user={user}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel - Preview & History */}
          <div className="preview-panel">
            {/* Preview Section */}
            <div ref={previewRef} className="preview-section">
              <PreviewPanel
                image={selectedImage}
                isGenerating={isGenerating}
                progress={generationProgress}
                onDownload={handleDownload}
                onShare={handleShare}
                onRegenerate={handleRegenerate}
                onVariate={() => {/* Handle variation generation */}}
                user={user}
              />
            </div>

            {/* History Section */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  className="history-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <HistoryPanel
                    history={history}
                    loading={historyLoading}
                    selectedImage={selectedImage}
                    onSelectImage={handleSelectImage}
                    onClose={() => setShowHistory(false)}
                    onRefresh={refetchHistory}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show History Toggle */}
            {!showHistory && (
              <button
                className="show-history-btn"
                onClick={() => setShowHistory(true)}
              >
                <ImageIcon size={16} />
                Show History
              </button>
            )}
          </div>
        </div>

        {/* Recent Generations Grid */}
        {generatedImages.length > 0 && (
          <div className="recent-generations">
            <div className="section-header">
              <h3>Recent Generations</h3>
              <button
                className="btn-text"
                onClick={() => setGeneratedImages([])}
              >
                Clear All
              </button>
            </div>
            <div className="generations-grid">
              {generatedImages.map((image, index) => (
                <motion.div
                  key={image.id || index}
                  className="generation-item"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleSelectImage(image)}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="image-container">
                    <img
                      src={`${process.env.REACT_APP_CDN_URL}/images/${image.id}.jpg`}
                      alt={image.prompt}
                      loading="lazy"
                    />
                    <div className="image-overlay">
                      <div className="overlay-actions">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(image);
                          }}
                          className="action-btn"
                        >
                          <Download size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(image);
                          }}
                          className="action-btn"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="generation-info">
                    <p className="truncate">{image.prompt}</p>
                    <div className="generation-meta">
                      <span className="meta-item">
                        {image.model || 'SD XL'}
                      </span>
                      <span className="meta-item">
                        {image.width}×{image.height}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Stats & Tips */}
        <div className="usage-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <Clock size={20} />
                <h4>Today's Usage</h4>
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {history?.todayCount || 0}/{user?.subscription?.dailyLimit || 10}
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((history?.todayCount || 0) / (user?.subscription?.dailyLimit || 10)) * 100}%`
                    }}
                  />
                </div>
                <p className="stat-note">
                  {user?.subscription?.tier === 'free'
                    ? 'Free tier limit: 10 images/day'
                    : `${user.subscription.tier} tier: ${user.subscription.dailyLimit} images/day`}
                </p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Zap size={20} />
                <h4>Available Credits</h4>
              </div>
              <div className="stat-content">
                <div className="stat-value">{user?.credits || 0}</div>
                <p className="stat-note">
                  {user?.subscription?.tier === 'free'
                    ? 'Upgrade for more credits'
                    : `${user.credits} credits remaining`}
                </p>
                <button
                  className="btn-outline btn-sm"
                  onClick={() => navigate('/billing')}
                >
                  {user?.subscription?.tier === 'free' ? 'Upgrade Plan' : 'Buy Credits'}
                </button>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Rocket size={20} />
                <h4>Tips for Better Results</h4>
              </div>
              <div className="tips-list">
                <div className="tip-item">
                  <span className="tip-icon">💡</span>
                  <span>Be specific with details</span>
                </div>
                <div className="tip-item">
                  <span className="tip-icon">🎨</span>
                  <span>Use artistic style names</span>
                </div>
                <div className="tip-item">
                  <span className="tip-icon">📐</span>
                  <span>Specify composition and lighting</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ImageGeneration;
