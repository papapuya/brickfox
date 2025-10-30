import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users,
  TrendingUp,
  Zap,
  DollarSign,
  Search,
  Crown
} from 'lucide-react';
import { useState } from 'react';

interface CustomerStats {
  id: string;
  email: string;
  username?: string;
  isAdmin: boolean;
  planId?: string;
  subscriptionStatus?: string;
  apiCallsUsed: number;
  apiCallsLimit: number;
  projectCount: number;
  productCount: number;
  createdAt: string;
}

interface CustomersData {
  success: boolean;
  customers: CustomerStats[];
}

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery<CustomersData>({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/customers', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Zugriff verweigert - nur für Administratoren');
        }
        throw new Error('Failed to load customers');
      }
      return res.json();
    },
  });

  const customers = data?.customers || [];
  const filteredCustomers = customers.filter(
    (c) =>
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate overall stats
  const totalCustomers = customers.length;
  const activeSubscriptions = customers.filter(
    (c) => c.subscriptionStatus === 'active'
  ).length;
  const totalApiCalls = customers.reduce((sum, c) => sum + c.apiCallsUsed, 0);
  const totalProjects = customers.reduce((sum, c) => sum + c.projectCount, 0);

  const getPlanBadgeColor = (planId?: string) => {
    switch (planId) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'pro':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'starter':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'trial':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'past_due':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'canceled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'trial':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-8 w-8 text-amber-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
        </div>
        <p className="text-gray-600">Übersicht aller Kunden und Statistiken</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-indigo-100 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Gesamt-Kunden</CardTitle>
                <Users className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-600">{totalCustomers}</div>
                <p className="text-xs text-gray-500 mt-1">Registrierte User</p>
              </CardContent>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Aktive Abos</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{activeSubscriptions}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {((activeSubscriptions / Math.max(totalCustomers, 1)) * 100).toFixed(0)}% Conversion
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-100 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">API Calls (Gesamt)</CardTitle>
                <Zap className="h-4 w-4 text-violet-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-violet-600">{totalApiCalls}</div>
                <p className="text-xs text-gray-500 mt-1">Genutzte AI-Generierungen</p>
              </CardContent>
            </Card>

            <Card className="border-amber-100 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Projekte (Gesamt)</CardTitle>
                <DollarSign className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{totalProjects}</div>
                <p className="text-xs text-gray-500 mt-1">Erstellte Projekte</p>
              </CardContent>
            </Card>
          </div>

          {/* Customer Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Kunden-Übersicht</CardTitle>
                  <CardDescription>Alle registrierten Benutzer mit Details</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Kunden suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Plan</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">API Calls</TableHead>
                      <TableHead className="font-semibold text-right">Projekte</TableHead>
                      <TableHead className="font-semibold text-right">Produkte</TableHead>
                      <TableHead className="font-semibold">Registriert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Keine Kunden gefunden
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {customer.isAdmin && (
                                <Crown className="h-4 w-4 text-amber-500" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{customer.email}</div>
                                {customer.username && (
                                  <div className="text-xs text-gray-500">{customer.username}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPlanBadgeColor(customer.planId)}>
                              {customer.planId === 'trial' ? 'Trial' : customer.planId || 'Free'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getStatusBadgeColor(customer.subscriptionStatus)}
                            >
                              {customer.subscriptionStatus === 'active'
                                ? 'Aktiv'
                                : customer.subscriptionStatus === 'past_due'
                                ? 'Überfällig'
                                : customer.subscriptionStatus === 'canceled'
                                ? 'Gekündigt'
                                : customer.subscriptionStatus || 'Trial'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm">
                              <span className="font-medium">{customer.apiCallsUsed}</span>
                              <span className="text-gray-400"> / {customer.apiCallsLimit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {customer.projectCount}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {customer.productCount}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(customer.createdAt).toLocaleDateString('de-DE')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
