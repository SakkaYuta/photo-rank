import * as React from 'react'
import { ShieldCheck, BadgeCheck, Award, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type TrustBadgesProps = {
  className?: string
  showVerified?: boolean
  showHighRating?: boolean
  showAchievement?: boolean
  showFastResponse?: boolean
}

export const TrustBadges: React.FC<TrustBadgesProps> = ({
  className,
  showVerified = true,
  showHighRating = true,
  showAchievement = true,
  showFastResponse = true,
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`} aria-label="信頼性バッジ">
      {showVerified && (
        <Badge variant="primary" aria-label="認証済みパートナー">
          <ShieldCheck className="mr-1 h-4 w-4" aria-hidden="true" /> 認証済み
        </Badge>
      )}
      {showHighRating && (
        <Badge variant="success" aria-label="高評価">
          <BadgeCheck className="mr-1 h-4 w-4" aria-hidden="true" /> 高評価
        </Badge>
      )}
      {showAchievement && (
        <Badge variant="secondary" aria-label="実績豊富">
          <Award className="mr-1 h-4 w-4" aria-hidden="true" /> 実績
        </Badge>
      )}
      {showFastResponse && (
        <Badge variant="warning" aria-label="迅速な応答">
          <Zap className="mr-1 h-4 w-4" aria-hidden="true" /> 応答速
        </Badge>
      )}
    </div>
  )
}

export default TrustBadges
