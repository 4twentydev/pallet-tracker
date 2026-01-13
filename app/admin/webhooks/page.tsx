'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  getWebhookSubscriptions,
  createWebhookSubscriptionAction,
  renewWebhookSubscriptionAction,
  deleteWebhookSubscriptionAction,
  validateWebhookSubscriptionAction,
  autoRenewSubscriptionsAction,
} from '@/app/actions/webhooks';
import { Plus, RefreshCw, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface WebhookSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  clientState: string;
  expirationDateTime: Date;
  createdDateTime: Date;
  active: boolean;
  lastRenewed: Date | null;
  renewalAttempts: number;
  lastError: string | null;
  lastErrorAt: Date | null;
}

export default function WebhooksAdminPage() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    try {
      const result = await getWebhookSubscriptions();
      if (result.success && result.data) {
        setSubscriptions(result.data);
      } else {
        console.error('Failed to load subscriptions:', result.error);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubscription() {
    setActionLoading('create');
    try {
      const result = await createWebhookSubscriptionAction();
      if (result.success) {
        await loadSubscriptions();
        alert('Subscription created successfully!');
      } else {
        alert(`Failed to create subscription: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      alert('An error occurred while creating the subscription');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRenewSubscription(subscriptionId: string) {
    setActionLoading(`renew-${subscriptionId}`);
    try {
      const result = await renewWebhookSubscriptionAction(subscriptionId);
      if (result.success) {
        await loadSubscriptions();
        alert('Subscription renewed successfully!');
      } else {
        alert(`Failed to renew subscription: ${result.error}`);
      }
    } catch (error) {
      console.error('Error renewing subscription:', error);
      alert('An error occurred while renewing the subscription');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteSubscription(subscriptionId: string) {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    setActionLoading(`delete-${subscriptionId}`);
    try {
      const result = await deleteWebhookSubscriptionAction(subscriptionId);
      if (result.success) {
        await loadSubscriptions();
        alert('Subscription deleted successfully!');
      } else {
        alert(`Failed to delete subscription: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      alert('An error occurred while deleting the subscription');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAutoRenew() {
    setActionLoading('auto-renew');
    try {
      const result = await autoRenewSubscriptionsAction();
      if (result.success) {
        await loadSubscriptions();
        alert(
          `Auto-renewal completed!\nRenewed: ${result.data.renewed}\nFailed: ${result.data.failed}`
        );
      } else {
        alert(`Failed to auto-renew: ${result.error}`);
      }
    } catch (error) {
      console.error('Error auto-renewing:', error);
      alert('An error occurred during auto-renewal');
    } finally {
      setActionLoading(null);
    }
  }

  function getExpirationStatus(expirationDateTime: Date) {
    const now = new Date();
    const expiration = new Date(expirationDateTime);
    const hoursUntilExpiration = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiration < 0) {
      return { status: 'expired', color: 'destructive' as const, icon: XCircle };
    } else if (hoursUntilExpiration < 24) {
      return { status: 'expiring-soon', color: 'secondary' as const, icon: AlertCircle };
    } else {
      return { status: 'active', color: 'default' as const, icon: CheckCircle };
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <p>Loading webhook subscriptions...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Subscriptions</CardTitle>
              <CardDescription>
                Manage Microsoft Graph webhook subscriptions for Excel changes
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAutoRenew}
                variant="outline"
                disabled={actionLoading !== null}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Auto Renew
              </Button>
              <Button
                onClick={handleCreateSubscription}
                disabled={actionLoading !== null}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Subscription
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">No webhook subscriptions found</p>
              <Button onClick={handleCreateSubscription}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Subscription
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Change Type</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => {
                  const expirationStatus = getExpirationStatus(subscription.expirationDateTime);
                  const ExpirationIcon = expirationStatus.icon;

                  return (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={subscription.active ? 'default' : 'secondary'}>
                            {subscription.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <ExpirationIcon
                            className={`h-4 w-4 ${
                              expirationStatus.status === 'expired'
                                ? 'text-destructive'
                                : expirationStatus.status === 'expiring-soon'
                                ? 'text-yellow-500'
                                : 'text-green-500'
                            }`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {subscription.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs">
                        {subscription.resource.split('/').pop()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscription.changeType}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(subscription.expirationDateTime), 'PPp')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(subscription.createdDateTime), 'PPp')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRenewSubscription(subscription.id)}
                            disabled={
                              actionLoading !== null ||
                              !subscription.active ||
                              expirationStatus.status === 'expired'
                            }
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSubscription(subscription.id)}
                            disabled={actionLoading !== null}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {subscriptions.some((s) => s.lastError) && (
          <CardFooter>
            <div className="w-full">
              <h4 className="text-sm font-medium mb-2">Recent Errors:</h4>
              {subscriptions
                .filter((s) => s.lastError)
                .map((subscription) => (
                  <div
                    key={subscription.id}
                    className="text-xs text-destructive mb-1"
                  >
                    {subscription.id}: {subscription.lastError}
                  </div>
                ))}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
