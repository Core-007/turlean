'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { RatingStars } from '@/components/rating-stars'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Calendar, Clock, MapPin, Home, School, Wallet, TrendingUp,
  CheckCircle2, XCircle, AlertCircle, Phone, MessageSquare,
  Star, BookOpen, Users, ArrowRight, Briefcase, GraduationCap,
  PencilLine, BookOpenCheck, CalendarCheck, ExternalLink, Sparkles,
  Award, ChevronRight, UserCheck, Clock3, ShieldCheck, Video
} from 'lucide-react'
import { formatVnd, formatDate, timeAgo } from '@/lib/format'
import { toast } from 'sonner'

interface Booking {
  id: string
  tutorId: string
  studentId: string
  mode: string
  date: string
  startTime: string
  endTime: string
  durationHours: number
  status: string
  createdAt?: string
  address?: string | null
  note?: string | null
  totalAmount: number
  review?: { id: string; rating: number } | null // P0-2: đã đánh giá chưa
  tutor: { id: string, name: string, avatar?: string | null, profession?: string | null, phone?: string | null, address?: string | null, district?: string | null, lat?: number | null, lng?: number | null }
  student: { id: string, name: string, avatar?: string | null, phone?: string | null, address?: string | null, district?: string | null }
  subject: { id: string, name: string }
}

interface Stats {
  subjectCount: number
  availabilityCount: number
  reviewCount: number
  avgRating: number
  totalEarnings: number
  totalHours: number
  uniqueStudents: number
  totalBookings: number
}

interface Completeness {
  percent: number
  checks: Record<string, boolean>
  missing: string[]
}

interface ReliabilityData {
  reliability: {
    score: number
    tier: { key: string; label: string; color: string }
    totalCancellations: number
    violations: number
    warnings: number
  }
  violations: {
    id: string
    severity: string
    points: number
    reason: string
    hoursBefore: number
    createdAt: string
    subject: string
    counterpart: string
    date: string
    startTime: string
  }[]
}

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  SEVERE: { label: 'Vi phạm nghiêm trọng', color: 'text-rose-600 bg-rose-100' },
  VIOLATION: { label: 'Vi phạm', color: 'text-rose-600 bg-rose-50' },
  WARNING: { label: 'Cảnh báo', color: 'text-amber-600 bg-amber-100' },
  MINOR: { label: 'Nhẹ', color: 'text-amber-600 bg-amber-50' },
  NONE: { label: 'Không ảnh hưởng', color: 'text-muted-foreground bg-muted' },
}

const TIER_COLOR_CLASS: Record<string, string> = {
  EXCELLENT: 'text-emerald-600',
  GOOD: 'text-blue-600',
  AVERAGE: 'text-amber-600',
  POOR: 'text-rose-600',
}

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  COMPLETED: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  CANCELLED: { label: 'Đã hủy', color: 'bg-rose-100 text-rose-700', icon: XCircle },
}

const COMPLETENESS_LABELS: Record<string, string> = {
  hasBio: 'Giới thiệu bản thân',
  hasProfession: 'Chức danh chuyên môn',
  hasEducation: 'Học vấn',
  hasHourlyRate: 'Học phí',
  hasSubjects: 'Môn dạy',
  hasAvailability: 'Lịch trống',
  hasTeachingMode: 'Phương thức dạy',
  hasLocation: 'Vị trí',
}

export function DashboardPage() {
  const { user, navigate } = useApp()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'requests' | 'upcoming' | 'history'>('requests')
  const [stats, setStats] = useState<Stats | null>(null)
  const [completeness, setCompleteness] = useState<Completeness | null>(null)
  const [reliabilityData, setReliabilityData] = useState<ReliabilityData | null>(null)

  // P0-1: dialog hủy lịch kèm lý do
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [submittingCancel, setSubmittingCancel] = useState(false)

  // P0-2: dialog đánh giá buổi học (thay cho toast "sẽ có sớm")
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch(`/api/bookings?role=${user.role === 'TUTOR' ? 'tutor' : 'student'}`).then(r => r.json()),
      user.role === 'TUTOR'
        ? fetch('/api/tutors/me/stats').then(r => r.json())
        : Promise.resolve(null),
      // P0-1: điểm tin cậy & lịch sử vi phạm của chính mình
      fetch('/api/users/me/violations').then(r => r.json()).catch(() => null),
    ]).then(([data, s, rel]) => {
      setBookings(data.bookings || [])
      if (s?.stats) setStats(s.stats)
      if (s?.completeness) setCompleteness(s.completeness)
      if (rel?.reliability) setReliabilityData(rel)
      setLoading(false)
    })
  }, [user])

  if (!user) {
    return (
      <div className="container mx-auto max-w-md py-16 text-center">
        <h2 className="text-2xl font-bold mb-2">Cần đăng nhập</h2>
        <Button onClick={() => navigate({ name: 'login' })}>Đăng nhập</Button>
      </div>
    )
  }

  const isTutor = user.role === 'TUTOR'
  const otherParty = isTutor ? 'student' : 'tutor'

  const now = new Date()
  // Tutor: requests = pending bookings they need to confirm
  // Student: requests = pending bookings waiting for tutor's confirmation (also visible in upcoming)
  const requests = bookings.filter(b => b.status === 'PENDING' && new Date(b.date + 'T' + b.startTime) >= now)

  // Upcoming: confirmed OR pending (for student) bookings that haven't passed
  const upcoming = bookings.filter(b => {
    if (new Date(b.date + 'T' + b.startTime) < now) return false
    if (isTutor) return b.status === 'CONFIRMED'
    // Student: see both PENDING (awaiting confirmation) and CONFIRMED
    return b.status === 'CONFIRMED' || b.status === 'PENDING'
  })
  const history = bookings.filter(b =>
    b.status === 'COMPLETED' || b.status === 'CANCELLED' ||
    new Date(b.date + 'T' + b.startTime) < now
  )

  requests.sort((a, b) => a.createdAt?.localeCompare(b.createdAt?.toString() || '') || 0)
  upcoming.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
  history.sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))

  const totalSpent = !isTutor
    ? bookings.filter(b => b.status === 'COMPLETED').reduce((s, b) => s + b.totalAmount, 0)
    : 0

  const handleStatusChange = async (bookingId: string, status: string) => {
    const actionLabel = status === 'CONFIRMED' ? 'xác nhận' : 'cập nhật'
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cập nhật thất bại')
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b))
      toast.success(`Đã ${actionLabel} thành công`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // P0-1: mở dialog hủy lịch (bắt buộc lý do >= 5 ký tự)
  const openCancelDialog = (b: Booking) => {
    setCancelTarget(b)
    setCancelReason('')
  }

  const submitCancel = async () => {
    if (!cancelTarget) return
    if (cancelReason.trim().length < 5) {
      toast.error('Vui lòng nhập lý do hủy (tối thiểu 5 ký tự)')
      return
    }
    setSubmittingCancel(true)
    try {
      const res = await fetch(`/api/bookings/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Hủy lịch thất bại')
      setBookings(prev => prev.map(b => b.id === cancelTarget.id ? { ...b, status: 'CANCELLED' } : b))
      toast.success(data.message || 'Đã hủy lịch')
      if (data.violation?.points > 0) {
        toast.warning(`Độ tin cậy của bạn bị trừ ${data.violation.points} điểm (${data.violation.label})`, { duration: 6000 })
      }
      setCancelTarget(null)
      // Làm mới điểm tin cậy sau khi hủy
      fetch('/api/users/me/violations').then(r => r.json()).then(rel => {
        if (rel?.reliability) setReliabilityData(rel)
      }).catch(() => {})
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmittingCancel(false)
    }
  }

  // P0-2: gửi đánh giá thật qua API
  const submitReview = async () => {
    if (!reviewTarget) return
    if (reviewRating < 1) {
      toast.error('Vui lòng chọn số sao đánh giá')
      return
    }
    setSubmittingReview(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: reviewTarget.id,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gửi đánh giá thất bại')
      toast.success('Cảm ơn bạn đã đánh giá buổi học!')
      setReviewTarget(null)
      setReviewRating(5)
      setReviewComment('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmittingReview(false)
    }
  }

  const BookingCard = ({ b, showActions = true }: { b: Booking, showActions?: boolean }) => {
    const status = STATUS_MAP[b.status] || STATUS_MAP.PENDING
    const StatusIcon = status.icon
    const other = b[otherParty as 'tutor' | 'student']
    const classStart = new Date(b.date + 'T' + b.startTime)
    const isPast = classStart < now // buổi học ĐÃ ĐẾN/QUA giờ bắt đầu
    const modeLabel = b.mode === 'ONLINE' ? 'Trực tuyến' : b.mode === 'TUTOR_TO_STUDENT' ? 'Gia sư đến nhà' : 'Tại cơ sở'

    return (
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 rounded-xl">
            <AvatarImage src={other.avatar || undefined} alt={other.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {other.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{other.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {b.subject.name} • {isTutor ? 'Học sinh' : 'Gia sư'}
                  {other.district ? ` • ${other.district}` : ''}
                </p>
              </div>
              <Badge className={`${status.color} border-0 text-[10px] gap-1 shrink-0`}>
                <StatusIcon className="h-3 w-3" /> {status.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(b.date)}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {b.startTime} - {b.endTime}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {b.mode === 'TUTOR_TO_STUDENT' ? <Home className="h-3.5 w-3.5" /> : b.mode === 'ONLINE' ? <Video className="h-3.5 w-3.5" /> : <School className="h-3.5 w-3.5" />}
                {modeLabel}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{formatVnd(b.totalAmount)}</span>
              </div>
            </div>

            {b.address && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{b.address}</span>
              </div>
            )}

            {b.note && (
              <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <span className="font-semibold">Ghi chú:</span> {b.note}
              </div>
            )}

            {showActions && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {b.status === 'PENDING' && isTutor && (
                  <>
                    <Button size="sm" onClick={() => handleStatusChange(b.id, 'CONFIRMED')} disabled={isPast}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Xác nhận
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openCancelDialog(b)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Từ chối
                    </Button>
                  </>
                )}
                {b.status === 'PENDING' && !isTutor && (
                  <Button size="sm" variant="outline" onClick={() => openCancelDialog(b)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Hủy yêu cầu
                  </Button>
                )}
                {/* P0-2: đánh dấu hoàn thành chỉ hiện SAU khi buổi học đã bắt đầu */}
                {b.status === 'CONFIRMED' && isPast && isTutor && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(b.id, 'COMPLETED')}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Đánh dấu đã dạy xong
                  </Button>
                )}
                {b.status === 'CONFIRMED' && !isPast && (
                  <Button size="sm" variant="outline" onClick={() => openCancelDialog(b)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Hủy buổi học
                  </Button>
                )}
                {other.phone && (b.status === 'CONFIRMED' || b.status === 'COMPLETED') && (
                  <Button size="sm" variant="ghost" onClick={() => window.open(`tel:${other.phone}`)}>
                    <Phone className="h-3.5 w-3.5 mr-1" /> Gọi
                  </Button>
                )}
              </div>
            )}

            {/* P0-2: trạng thái đánh giá — nút chỉ hiện cho buổi CHƯA đánh giá,
                 buổi đã đánh giá hiển thị sao đã chấm */}
            {b.status === 'COMPLETED' && !isTutor && !b.review && (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setReviewTarget(b)}>
                  <Star className="h-3.5 w-3.5 mr-1" /> Đánh giá buổi học
                </Button>
              </div>
            )}
            {b.status === 'COMPLETED' && !isTutor && b.review && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>Đã đánh giá {b.review.rating}/5</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // P0-1: thẻ độ tin cậy hiển thị trong dashboard (cả 2 vai trò)
  const ReliabilitySection = () => {
    if (!reliabilityData?.reliability) return null
    const rel = reliabilityData.reliability
    const tierClass = TIER_COLOR_CLASS[rel.tier.key] || 'text-muted-foreground'
    return (
      <Card className="p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="font-semibold text-sm">Độ tin cậy của bạn</h3>
              <span className={`text-lg font-bold ${tierClass}`}>
                {rel.score}/100 · {rel.tier.label}
              </span>
            </div>
            <Progress value={rel.score} className="h-2 mb-3" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Lần hủy</p>
                <p className="font-bold text-sm">{rel.totalCancellations}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Vi phạm</p>
                <p className="font-bold text-sm text-rose-600">{rel.violations}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">Cảnh báo</p>
                <p className="font-bold text-sm text-amber-600">{rel.warnings}</p>
              </div>
            </div>
            {reliabilityData.violations.length > 0 && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {reliabilityData.violations.slice(0, 5).map(v => (
                  <div key={v.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border text-xs">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.subject} — {v.counterpart}</p>
                      <p className="text-muted-foreground truncate">{v.reason}</p>
                      <p className="text-muted-foreground/70">{formatDate(v.date)} {v.startTime} · {timeAgo(v.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${SEVERITY_MAP[v.severity]?.color ?? ''}`}>
                      -{v.points}đ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  // P0-1 + P0-2: dialog hủy lịch (lý do bắt buộc) + dialog đánh giá buổi học
  const DashboardDialogs = () => (
    <>
      {/* Dialog hủy lịch kèm lý do */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy buổi học</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>Buổi {cancelTarget.subject.name} · {formatDate(cancelTarget.date)} · {cancelTarget.startTime}—{cancelTarget.endTime}</>
              )}
              <br />Lý do hủy là bắt buộc và được ghi lại để bảo vệ tính minh bạch cho cả hai bên.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ví dụ: Con ốm phải đưa đi khám... (tối thiểu 5 ký tự)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Hủy sát giờ học có thể ảnh hưởng điểm độ tin cậy của bạn.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Giữ lịch</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={submittingCancel || cancelReason.trim().length < 5}>
              {submittingCancel ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog đánh giá buổi học (P0-2) */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Đánh giá buổi học</DialogTitle>
            <DialogDescription>
              {reviewTarget && (
                <>Buổi {reviewTarget.subject.name} với gia sư {reviewTarget.tutor.name} · {formatDate(reviewTarget.date)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-semibold mb-2">Bạn đánh giá buổi học này mấy sao?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`${star} sao`}
                  >
                    <Star
                      className={`h-8 w-8 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Nhận xét (tùy chọn)</p>
              <Textarea
                placeholder="Gia sư dạy dễ hiểu, đúng giờ, nhiệt tình..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Để sau</Button>
            <Button onClick={submitReview} disabled={submittingReview}>
              {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  // TUTOR DASHBOARD LAYOUT
  if (isTutor) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Xin chào, {user.name}!</h1>
            <p className="text-sm text-muted-foreground">Quản lý lớp học, lịch dạy và thu nhập</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ name: 'my-profile' })}>
              <ExternalLink className="h-4 w-4 mr-1" /> Xem hồ sơ
            </Button>
            <Button variant="outline" onClick={() => navigate({ name: 'profile-edit' })}>
              <PencilLine className="h-4 w-4 mr-1" /> Sửa hồ sơ
            </Button>
          </div>
        </div>

        {/* Profile completeness alert */}
        {completeness && completeness.percent < 100 && (
          <Card className="p-4 mb-6 border-amber-200 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm">Hoàn thiện hồ sơ ({completeness.percent}%)</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ name: 'onboarding' })}
                  >
                    Hoàn thiện ngay <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Hồ sơ đầy đủ 100% được ưu tiên hiển thị và nhận nhiều yêu cầu hơn
                </p>
                <Progress value={completeness.percent} className="h-2" />
                {completeness.missing.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {completeness.missing.map(m => (
                      <Badge key={m} variant="outline" className="text-[10px] gap-1 bg-background">
                        <XCircle className="h-3 w-3 text-amber-600" />
                        {COMPLETENESS_LABELS[m] || m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Thu nhập</p>
                <p className="text-lg font-bold">{formatVnd(stats?.totalEarnings || 0)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Học sinh</p>
                <p className="text-lg font-bold">{stats?.uniqueStudents || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giờ dạy</p>
                <p className="text-lg font-bold">{stats?.totalHours || 0}h</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Đánh giá</p>
                <p className="text-lg font-bold">{stats?.avgRating.toFixed(1) || '0.0'}★ ({stats?.reviewCount || 0})</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
            onClick={() => navigate({ name: 'manage-subjects' })}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Môn dạy</p>
                  <p className="text-xs text-muted-foreground">{stats?.subjectCount || 0} môn</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
            onClick={() => navigate({ name: 'manage-availability' })}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Lịch trống</p>
                  <p className="text-xs text-muted-foreground">{stats?.availabilityCount || 0} slot/tuần</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </Card>

          <Card
            className="p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
            onClick={() => navigate({ name: 'my-profile' })}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Hồ sơ công khai</p>
                  <p className="text-xs text-muted-foreground">Xem như học sinh</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </Card>
        </div>

        {/* P0-1: độ tin cậy của gia sư */}
        <ReliabilitySection />

        {/* Bookings tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="requests" className="relative">
              Yêu cầu mới
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming">Sắp dạy ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="history">Lịch sử ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            {loading ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">Đang tải...</Card>
            ) : requests.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Không có yêu cầu mới</h3>
                <p className="text-sm text-muted-foreground">
                  Khi học sinh đặt lịch, yêu cầu sẽ xuất hiện ở đây để bạn xác nhận
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {requests.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming">
            {loading ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">Đang tải...</Card>
            ) : upcoming.length === 0 ? (
              <Card className="p-12 text-center">
                <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Chưa có buổi học sắp tới</h3>
                <p className="text-sm text-muted-foreground">
                  Các buổi học đã xác nhận sẽ hiển thị tại đây
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {loading ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">Đang tải...</Card>
            ) : history.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">Chưa có lịch sử dạy</h3>
                <p className="text-sm text-muted-foreground">
                  Buổi học đã hoàn thành hoặc hủy sẽ hiển thị tại đây
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map(b => <BookingCard key={b.id} b={b} showActions={false} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DashboardDialogs />
      </div>
    )
  }

  // STUDENT DASHBOARD LAYOUT
  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Xin chào, {user.name}!</h1>
          <p className="text-sm text-muted-foreground">Theo dõi lịch học và quản lý buổi học</p>
        </div>
        <Button onClick={() => navigate({ name: 'search' })}>
          <Users className="h-4 w-4 mr-1" /> Tìm gia sư
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sắp học</p>
              <p className="text-lg font-bold">{upcoming.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Đã học</p>
              <p className="text-lg font-bold">{bookings.filter(b => b.status === 'COMPLETED').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng chi</p>
              <p className="text-lg font-bold">{formatVnd(totalSpent)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gia sư đã học</p>
              <p className="text-lg font-bold">{new Set(bookings.filter(b => b.status === 'COMPLETED').map(b => b.tutorId)).size}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* P0-1: độ tin cậy của học sinh/phụ huynh */}
      <ReliabilitySection />

      {/* Tabs */}
      <Tabs value={tab === 'requests' ? 'upcoming' : tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Sắp tới ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="history">Lịch sử ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {loading ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Đang tải...</Card>
          ) : upcoming.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Chưa có buổi học nào sắp tới</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Khám phá hàng trăm gia sư chất lượng và đặt lịch học ngay
              </p>
              <Button onClick={() => navigate({ name: 'search' })}>
                <Users className="h-4 w-4 mr-1" /> Tìm gia sư <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map(b => <BookingCard key={b.id} b={b} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {loading ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Đang tải...</Card>
          ) : history.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">Chưa có lịch sử học</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Buổi học đã hoàn thành sẽ hiển thị tại đây
              </p>
              <Button variant="outline" onClick={() => navigate({ name: 'search' })}>
                <Users className="h-4 w-4 mr-1" /> Bắt đầu học
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map(b => <BookingCard key={b.id} b={b} showActions={false} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DashboardDialogs />
    </div>
  )
}
