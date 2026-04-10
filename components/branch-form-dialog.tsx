'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BranchFormData {
  name: string
  code: string
  location: string
}

interface BranchFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  initialData?: BranchFormData
  onSave: (data: BranchFormData) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_FORM: BranchFormData = { name: '', code: '', location: '' }

export function BranchFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSave,
}: BranchFormDialogProps) {
  const [form, setForm] = useState<BranchFormData>(EMPTY_FORM)

  // Sync form when the dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      setForm(initialData ?? EMPTY_FORM)
    }
  }, [open, initialData])

  function handleChange(field: keyof BranchFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    onSave(form)
    onOpenChange(false)
  }

  const title = mode === 'add' ? '지점 추가' : '지점 수정'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-xl border-white/20 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-gray-100">
          <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* 지점명 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-name" className="text-sm font-semibold text-gray-700">
              지점명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="branch-name"
              type="text"
              placeholder="지점 이름을 입력하세요"
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className="h-12 rounded-lg border-gray-300 bg-gray-50 px-4 text-base text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#90BEDE] focus-visible:border-[#90BEDE] focus-visible:bg-white transition-all"
            />
          </div>

          {/* 관리 번호 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-code" className="text-sm font-semibold text-gray-700">
              관리 번호
            </Label>
            <Input
              id="branch-code"
              type="text"
              placeholder="ex. LOC-001"
              value={form.code}
              onChange={e => handleChange('code', e.target.value)}
              className="h-12 rounded-lg border-gray-300 bg-gray-50 px-4 text-base text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#90BEDE] focus-visible:border-[#90BEDE] focus-visible:bg-white transition-all"
            />
          </div>

          {/* 위치 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="branch-location" className="text-sm font-semibold text-gray-700">
              위치 <span className="text-red-500">*</span>
            </Label>
            <div className="relative flex items-center">
              <Input
                id="branch-location"
                type="text"
                placeholder="주소를 검색하세요"
                value={form.location}
                onChange={e => handleChange('location', e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pl-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus-visible:ring-[#90BEDE] focus-visible:border-[#90BEDE] focus-visible:bg-white transition-all"
              />
              <button
                type="button"
                title="지도에서 찾기"
                className="absolute right-3 p-1.5 text-[#90BEDE] hover:text-[#7aa8d0] hover:bg-[#90BEDE]/10 rounded-md transition-colors"
              >
                <MapPin className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 px-5 rounded-lg border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 focus-visible:ring-gray-200"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-10 px-6 rounded-lg font-semibold text-sm text-white shadow-sm hover:opacity-90 active:scale-95 focus-visible:ring-[#90BEDE]/40 transition-all"
            style={{ background: '#90BEDE' }}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
