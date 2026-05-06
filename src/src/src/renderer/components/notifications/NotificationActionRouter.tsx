import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

/**
 * Subscribes to OS-toast click-action broadcasts from main and routes the
 * renderer accordingly. Mount once inside the HashRouter context. No render
 * output — pure side-effect component.
 *
 * Click flow:
 *   user clicks Windows toast
 *     → main/notifications/dispatch.ts:fireOsToast.click
 *     → broadcasts NotificationsOnClickAction with { kind: 'navigate', target }
 *     → this component receives + navigates.
 */
export function NotificationActionRouter() {
  const navigate = useNavigate()
  useEffect(() => {
    const unsub = api.notifications.onClickAction((action) => {
      if (action?.kind === 'navigate' && typeof action.target === 'string') {
        const target = action.target
        const hashIdx = target.indexOf('#')
        if (hashIdx >= 0) {
          const path = target.slice(0, hashIdx)
          const anchor = target.slice(hashIdx + 1)
          navigate(path)
          setTimeout(() => {
            const el = document.getElementById(anchor)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        } else {
          navigate(target)
        }
      }
    })
    return unsub
  }, [navigate])
  return null
}
