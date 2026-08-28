import { useEffect, useState, type RefObject } from 'react'

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      return undefined
    }

    let frame = 0

    const measure = () => {
      frame = 0
      const element = ref.current
      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      const travel = Math.max(1, rect.height - window.innerHeight)
      setProgress(clamp(-rect.top / travel))
    }

    const scheduleMeasure = () => {
      if (frame !== 0) {
        return
      }
      frame = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [reducedMotion, ref])

  return reducedMotion ? 1 : progress
}

export function useActiveChapter(
  chapterIds: string[],
  onChapterChange: (chapterId: string) => void,
): void {
  useEffect(() => {
    const elements = chapterIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)

    if (elements.length === 0) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (active?.target.id) {
          onChapterChange(active.target.id)
        }
      },
      {
        rootMargin: '-38% 0px -38% 0px',
        threshold: [0, 0.2, 0.5, 0.8, 1],
      },
    )

    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [chapterIds, onChapterChange])
}
