"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

export function CoachWidget(){
  const { t } = useLanguage();
  const [tips, setTips] = useState<string[]>([])
  useEffect(()=>{
    let cancelled = false
    const load = async ()=>{
      try{
        const res = await fetch('/api/coach');
        if(!res.ok){ setTips([]); return }
        const j = await res.json()
        if(!cancelled) setTips(j.tips||[])
      }catch{ if(!cancelled) setTips([]) }
    }
    load();
    return ()=>{ cancelled = true }
  },[])
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="font-medium mb-2">{t('dashboard.coach') || 'Sugestões inteligentes'}</div>
      {tips.length===0 ? (
        <div className="text-sm text-muted-foreground">{t('dashboard.noCoachTips') || 'Sem sugestões no momento'}</div>
      ) : (
        <ul className="list-disc ml-5 space-y-1 text-sm">
          {tips.map((s, i)=> (<li key={i}>{s}</li>))}
        </ul>
      )}
    </div>
  )
}

export default CoachWidget
