// Sample data for Battle UI (development/demo only)

export type SampleBattle = {
  id: string
  title: string
  challenger_id: string
  opponent_id: string
  duration_minutes: 5|30|60
  start_time: string
  status: 'scheduled'|'live'|'finished'
}

export const SAMPLE_BATTLES: SampleBattle[] = [
  {
    id: 'demo-battle-1',
    title: 'デモ：推しグッズ速攻バトル',
    challenger_id: 'demo-user-1',
    opponent_id: 'demo-user-2',
    duration_minutes: 5,
    start_time: new Date(Date.now() - 60_000).toISOString(),
    status: 'live'
  },
  {
    id: 'demo-battle-2',
    title: 'デモ：Vtuber バトル',
    challenger_id: 'demo-user-3',
    opponent_id: 'demo-user-4',
    duration_minutes: 30,
    start_time: new Date(Date.now() + 10 * 60_000).toISOString(),
    status: 'scheduled'
  }
]

export const SAMPLE_PARTICIPANTS: Record<string, { id: string; display_name: string; avatar_url: string }> = {
  'demo-user-1': { id: 'demo-user-1', display_name: 'さくら', avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b332c66a?w=80&h=80&fit=crop&crop=face' },
  'demo-user-2': { id: 'demo-user-2', display_name: 'りく', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face' },
  'demo-user-3': { id: 'demo-user-3', display_name: 'みお', avatar_url: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=80&h=80&fit=crop&crop=face' },
  'demo-user-4': { id: 'demo-user-4', display_name: 'カイ', avatar_url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=face' },
}

export const SAMPLE_SCORES: Record<string, number> = {
  'demo-user-1': 15200,
  'demo-user-2': 14800,
  'demo-user-3': 0,
  'demo-user-4': 0
}

