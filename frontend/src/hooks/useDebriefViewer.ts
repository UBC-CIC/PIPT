import { useState, useRef, useCallback } from 'react';
import { instructorService } from '@/services/instructorService';
import { type AIDebriefData } from '@/services/studentService';
import { downloadChatPdf } from '@/lib/download-chat-pdf';
import { useNotification } from '@/components/notifications';

interface UseDebriefViewerParams {
  groupId: string | undefined;
}

interface UseDebriefViewerReturn {
  isAIDebriefOpen: boolean;
  selectedDebriefData: AIDebriefData | null;
  isFetchingDebrief: string | null;
  isGeneratingPdf: string | null;
  attemptPdfRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  viewDebrief: (attemptId: string) => Promise<void>;
  closeDebrief: () => void;
  downloadPdf: (attemptId: string, containerRef: HTMLDivElement) => Promise<void>;
}

/**
 * useDebriefViewer hook
 *
 * Manages AI debrief dialog state, debrief fetching, and PDF generation.
 * Shared between InstructorSimulationGroupPage and AdminSimulationGroupPage.
 */
export function useDebriefViewer({ groupId }: UseDebriefViewerParams): UseDebriefViewerReturn {
  const { showNotification } = useNotification();
  const [isAIDebriefOpen, setIsAIDebriefOpen] = useState(false);
  const [selectedDebriefData, setSelectedDebriefData] = useState<AIDebriefData | null>(null);
  const [isFetchingDebrief, setIsFetchingDebrief] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<string | null>(null);
  const attemptPdfRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const viewDebrief = useCallback(async (attemptId: string) => {
    setIsFetchingDebrief(attemptId);
    try {
      const data = await instructorService.fetchDebrief(attemptId, groupId || '');
      if (data) {
        setSelectedDebriefData(data);
        setIsAIDebriefOpen(true);
      } else {
        showNotification({ message: 'Debrief is still generating or not available for this session.', type: 'warning' });
      }
    } catch (error) {
      console.error('Failed to fetch AI debrief:', error);
      showNotification({ message: 'Failed to load AI Debrief. Please try again.', type: 'error' });
    } finally {
      setIsFetchingDebrief(null);
    }
  }, [groupId]);

  const closeDebrief = useCallback(() => {
    setIsAIDebriefOpen(false);
  }, []);

  const downloadPdf = useCallback(async (attemptId: string, containerRef: HTMLDivElement) => {
    setIsGeneratingPdf(attemptId);
    const scrollEls = Array.from(containerRef.querySelectorAll<HTMLElement>('.overflow-y-auto'));
    const prev = scrollEls.map((node) => ({
      node,
      maxHeight: node.style.maxHeight,
      overflowY: node.style.overflowY,
    }));
    scrollEls.forEach((node) => {
      node.style.maxHeight = 'none';
      node.style.overflowY = 'visible';
    });
    try {
      await downloadChatPdf({ element: containerRef, filename: `chat-${attemptId}.pdf`, scale: 2 });
    } catch (error) {
      console.error('Failed to download chat PDF:', error);
    } finally {
      prev.forEach(({ node, maxHeight, overflowY }) => {
        node.style.maxHeight = maxHeight;
        node.style.overflowY = overflowY;
      });
      setIsGeneratingPdf(null);
    }
  }, []);

  return {
    isAIDebriefOpen,
    selectedDebriefData,
    isFetchingDebrief,
    isGeneratingPdf,
    attemptPdfRefs,
    viewDebrief,
    closeDebrief,
    downloadPdf,
  };
}
