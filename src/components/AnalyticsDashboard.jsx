import { BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { usageApi } from '../api/apiClient';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch time-series data
        const tsResponse = await usageApi.getStats({ groupBy: 'day', period });
        setTimeSeriesData(processTimeSeriesData(tsResponse.stats));

        // Fetch distribution data (totals)
        const distResponse = await usageApi.getStats({ period });
        setDistributionData(distResponse.stats);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  // Transform API data for Recharts
  const processTimeSeriesData = (stats) => {
    // Group by date
    const grouped = {};
    stats.forEach(stat => {
      if (!grouped[stat.date]) {
        grouped[stat.date] = { date: stat.date };
      }
      grouped[stat.date][stat.event_type] = stat.total_count;
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brown-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  const totalEvents = distributionData.reduce((acc, curr) => acc + curr.total_count, 0);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('7d')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === '7d'
                ? 'bg-brown-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === '30d'
                ? 'bg-brown-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-600">Total Activity</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalEvents.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Events recorded in period</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-600">Top Event</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {distributionData[0]?.event_type || 'N/A'}
          </p>
          <p className="text-sm text-gray-500">
            {distributionData[0]?.total_count.toLocaleString() || 0} occurrences
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-600">Active Days</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{timeSeriesData.length}</p>
          <p className="text-sm text-gray-500">Days with activity</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">Activity Trends</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Bar dataKey="carsAdded" name="Cars Added" stackId="a" fill="#0088FE" />
                <Bar dataKey="carLocationChanges" name="Moves" stackId="a" fill="#00C49F" />
                <Bar dataKey="lateToggles" name="Late Marks" stackId="a" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Event Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">Event Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="total_count"
                  nameKey="event_type"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
