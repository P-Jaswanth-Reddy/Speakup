import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { motion } from "framer-motion";
import { Brain, MessageSquare, Users, FileText, Code2, ArrowRight, Loader2, Trophy, Clock, Target, TrendingUp, TrendingDown, Minus, Zap, Shield, Eye } from "lucide-react";
import { useDashboardStats, usePerformanceSummary, useTrajectory } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TOOLS = [
  {
    title: "Aptitude Practice",
    description: "Sharpen your logical and quantitative skills with topic-wise quizzes.",
    icon: Brain,
    href: "/aptitude",
    color: "bg-blue-500",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Mock Interview",
    description: "Practice with AI-driven mock interviews and get instant feedback.",
    icon: MessageSquare,
    href: "/interview",
    color: "bg-purple-500",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    title: "GD Simulator",
    description: "Participate in simulated group discussions with AI bots.",
    icon: Users,
    href: "/gd",
    color: "bg-orange-500",
    gradient: "from-orange-500 to-orange-600",
  },
  {
    title: "Resume Analyzer",
    description: "Upload your resume to check ATS compatibility and get suggestions.",
    icon: FileText,
    href: "/resume",
    color: "bg-emerald-500",
    gradient: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Code Practice",
    description: "Solve coding challenges with a built-in editor and instant AI evaluation.",
    icon: Code2,
    href: "/coding",
    color: "bg-cyan-500",
    gradient: "from-cyan-500 to-cyan-600",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardStats(user?.uid || "");
  const { data: pieSummary, isLoading: pieLoading } = usePerformanceSummary(user?.uid || "");
  const { data: trajectory, isLoading: trajLoading } = useTrajectory(user?.uid || "");
  const statsResponse = data;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Hello, {user?.name.split(" ")[0]}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">Ready to boost your placement preparation today?</p>
          </div>
          {isLoading ? (
             <div className="flex gap-4">
                <div className="h-10 w-32 bg-muted animate-pulse rounded-xl" />
             </div>
          ) : statsResponse && statsResponse.stats ? (
            <div className="flex gap-4">
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span>{(statsResponse.stats.totalInterviews + statsResponse.stats.totalGdSessions + statsResponse.stats.totalAptitudeTests)} Sessions</span>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
                 <Target className="w-4 h-4 text-blue-500" />
                 <span>Avg Score: {Math.round((statsResponse.stats.averageInterviewScore + statsResponse.stats.averageGdScore + statsResponse.stats.averageAptitudeScore) / 3)}%</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* ===== PERFORMANCE INTELLIGENCE + TRAJECTORY ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* PIE Card — spans 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="border-none shadow-lg bg-gradient-to-br from-white to-indigo-50/30 overflow-hidden h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    Performance Intelligence
                  </CardTitle>
                  {!pieLoading && pieSummary?.available && (
                    <Badge variant="outline" className="text-xs">{pieSummary.sessionCount} sessions analyzed</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {pieLoading ? (
                  /* Loading skeletons */
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[0,1,2].map(i => (
                        <div key={i} className="space-y-2">
                          <div className="h-4 bg-muted animate-pulse rounded w-24" />
                          <div className="h-8 bg-muted animate-pulse rounded w-12" />
                          <div className="h-1.5 bg-muted animate-pulse rounded-full w-full" />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="h-7 bg-muted animate-pulse rounded-full w-32" />
                      <div className="h-7 bg-muted animate-pulse rounded-full w-28" />
                      <div className="h-7 bg-muted animate-pulse rounded-full w-24" />
                    </div>
                    <div className="h-16 bg-muted animate-pulse rounded-xl w-full" />
                  </>
                ) : pieSummary?.available ? (
                  <>
                    {/* Dimension Scores */}
                    <div className="grid grid-cols-3 gap-4">
                      {pieSummary.dimensionScores?.map((dim) => {
                        const IconMap: Record<string, any> = { "Communication": MessageSquare, "Confidence": Shield, "Relevance": Eye };
                        const colorMap: Record<string, string> = { "Communication": "text-blue-600 bg-blue-100", "Confidence": "text-purple-600 bg-purple-100", "Relevance": "text-emerald-600 bg-emerald-100" };
                        const barColor: Record<string, string> = { "Communication": "bg-blue-500", "Confidence": "bg-purple-500", "Relevance": "bg-emerald-500" };
                        const DimIcon = IconMap[dim.name] || Brain;
                        return (
                          <div key={dim.name} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colorMap[dim.name] || 'bg-gray-100 text-gray-600'}`}>
                                <DimIcon className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-semibold text-slate-600">{dim.name}</span>
                            </div>
                            <div className="text-2xl font-black text-slate-800">{dim.score}</div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${barColor[dim.name] || 'bg-gray-400'}`} style={{ width: `${dim.score}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strongest / Weakest / Trend */}
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                        <TrendingUp className="w-3 h-3 text-green-600" />
                        <span className="text-xs font-bold text-green-700">Best: {pieSummary.strongestArea?.name} ({pieSummary.strongestArea?.score})</span>
                      </div>
                      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full">
                        <TrendingDown className="w-3 h-3 text-orange-600" />
                        <span className="text-xs font-bold text-orange-700">Focus: {pieSummary.weakestArea?.name} ({pieSummary.weakestArea?.score})</span>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                        pieSummary.trend === 'improving' ? 'bg-emerald-50 border-emerald-200' :
                        pieSummary.trend === 'declining' ? 'bg-red-50 border-red-200' :
                        'bg-slate-50 border-slate-200'
                      }`}>
                        {pieSummary.trend === 'improving' ? <TrendingUp className="w-3 h-3 text-emerald-600" /> :
                         pieSummary.trend === 'declining' ? <TrendingDown className="w-3 h-3 text-red-600" /> :
                         <Minus className="w-3 h-3 text-slate-500" />}
                        <span className={`text-xs font-bold ${
                          pieSummary.trend === 'improving' ? 'text-emerald-700' :
                          pieSummary.trend === 'declining' ? 'text-red-700' :
                          'text-slate-600'
                        }`}>
                          {pieSummary.trend === 'improving' ? `Improving +${pieSummary.trendDelta}` :
                           pieSummary.trend === 'declining' ? `Declining ${pieSummary.trendDelta}` :
                           'Stable'}
                        </span>
                      </div>
                    </div>

                    {/* Insight */}
                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-4">
                      <p className="text-sm text-slate-600 leading-relaxed italic">💡 {pieSummary.insight}</p>
                    </div>
                  </>
                ) : (
                  /* Empty state — not enough data yet */
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
                      <Zap className="w-7 h-7 text-indigo-300" />
                    </div>
                    <p className="font-semibold text-slate-600">Not enough data yet</p>
                    <p className="text-sm text-muted-foreground max-w-xs">Complete a few mock interviews to unlock your personalized performance analysis.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Trajectory Card — 1 col */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-none shadow-lg h-full bg-gradient-to-br from-white to-emerald-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  Growth Trajectory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {trajLoading ? (
                  <>
                    <div className="flex flex-col items-center space-y-2">
                      <div className="h-16 w-16 bg-muted animate-pulse rounded-xl" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="space-y-3 bg-white/80 border rounded-xl p-4">
                      <div className="h-3 bg-muted animate-pulse rounded w-full" />
                      <div className="h-3 bg-muted animate-pulse rounded w-full" />
                    </div>
                    <div className="flex justify-center">
                      <div className="h-9 w-36 bg-muted animate-pulse rounded-full" />
                    </div>
                  </>
                ) : trajectory?.available ? (
                  <>
                    <div className="text-center space-y-1">
                      <div className="text-5xl font-black text-slate-800">{trajectory.currentScore}</div>
                      <p className="text-xs text-muted-foreground font-medium">Latest Score</p>
                    </div>
                    <div className="bg-white/80 border rounded-xl p-4 space-y-3">
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Previous Avg</span>
                        <span className="font-bold text-slate-700">{trajectory.previousAverage}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Change</span>
                        <span className={`font-bold ${
                          trajectory.momentumStatus === 'upward' ? 'text-emerald-600' :
                          trajectory.momentumStatus === 'downward' ? 'text-red-600' :
                          'text-slate-600'
                        }`}>
                          {(trajectory.improvementPercentage ?? 0) > 0 ? '+' : ''}{trajectory.improvementPercentage}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
                        trajectory.momentumStatus === 'upward' ? 'bg-emerald-100 text-emerald-700' :
                        trajectory.momentumStatus === 'downward' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {trajectory.momentumStatus === 'upward' ? <TrendingUp className="w-4 h-4" /> :
                         trajectory.momentumStatus === 'downward' ? <TrendingDown className="w-4 h-4" /> :
                         <Minus className="w-4 h-4" />}
                        {trajectory.momentumStatus === 'upward' ? 'Upward Momentum' :
                         trajectory.momentumStatus === 'downward' ? 'Needs Attention' :
                         'Stable'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-emerald-300" />
                    </div>
                    <p className="font-semibold text-slate-600">No trajectory data</p>
                    <p className="text-sm text-muted-foreground">Complete at least 2 sessions to track your growth.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TOOLS.map((tool, index) => (
            <Link key={tool.title} href={tool.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative overflow-hidden bg-card rounded-2xl p-6 border hover:border-primary/50 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer h-full"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${tool.gradient} opacity-5 rounded-bl-full transform translate-x-8 -translate-y-8`} />
                
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center shadow-lg shadow-black/5`}>
                    <tool.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="bg-muted px-3 py-1 rounded-full text-xs font-semibold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    Start Now
                  </div>
                </div>
                
                <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{tool.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{tool.description}</p>
                
                <div className="mt-6 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                  Launch Tool <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-2xl border p-6">
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Recent Activity
          </h3>
          
          {isLoading ? (
             <div className="flex justify-center p-8"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground"/></div>
          ) : statsResponse?.recentActivity && statsResponse.recentActivity.length > 0 ? (
            <div className="space-y-4">
               {statsResponse.recentActivity.map((activity, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-colors border border-transparent hover:border-muted">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                          activity.type === 'aptitude' ? 'bg-blue-500' : 
                          activity.type === 'interview' ? 'bg-purple-500' : 
                          activity.type === 'gd' ? 'bg-orange-500' : 'bg-emerald-500'
                       }`}>
                          {activity.type === 'aptitude' ? <Brain className="w-5 h-5"/> : 
                           activity.type === 'interview' ? <MessageSquare className="w-5 h-5"/> : 
                           activity.type === 'gd' ? <Users className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                       </div>
                       <div>
                          <p className="font-bold text-sm text-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.date).toLocaleDateString()} • {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                       </div>
                    </div>
                    {activity.score !== undefined && (
                        <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                             activity.score >= 80 ? 'bg-green-100 text-green-700' : 
                             activity.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                             'bg-red-100 text-red-700'
                        }`}>
                           {activity.score}% Score
                        </div>
                    )}
                 </div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-xl border-muted">
               <p>No recent activity yet. Start your first practice session!</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
