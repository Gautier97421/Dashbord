'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistance } from 'date-fns';

interface ActionLog {
  id: string;
  actionType: string;
  status: 'success' | 'failed';
  input: Record<string, any>;
  output?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
}

export default function ActionHistory() {
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/history');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch history');
        return;
      }

      setActions(data.actions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (actionType: string): string => {
    const labels: Record<string, string> = {
      'gmail.labelEmails': 'Label Emails',
      'gmail.moveEmails': 'Move Emails',
      'gmail.readEmails': 'Read Emails',
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="text-red-600 py-8">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action History</CardTitle>
          <CardDescription>No actions yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            When you confirm AI suggestions, they will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action History</CardTitle>
        <CardDescription>Recent email actions performed by the AI assistant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50 transition"
            >
              {/* Status Icon */}
              <div className="mt-1">
                {action.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getActionLabel(action.actionType)}</span>
                  <Badge variant={action.status === 'success' ? 'default' : 'destructive'}>
                    {action.status}
                  </Badge>
                </div>

                {/* Parameters */}
                <div className="text-sm text-muted-foreground mt-1">
                  {Object.entries(action.input)
                    .map(([key, value]) => {
                      if (key === 'maxResults') return null;
                      return `${key}: ${JSON.stringify(value)}`;
                    })
                    .filter(Boolean)
                    .join(', ')}
                </div>

                {/* Result Summary */}
                {action.output && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {action.actionType === 'gmail.labelEmails' && action.output.appliedToCount !== undefined && (
                      <span>✓ Applied to {action.output.appliedToCount} email(s)</span>
                    )}
                    {action.actionType === 'gmail.moveEmails' && action.output.movedCount !== undefined && (
                      <span>✓ Moved {action.output.movedCount} email(s)</span>
                    )}
                    {action.actionType === 'gmail.readEmails' && action.output.messageCount !== undefined && (
                      <span>✓ Found {action.output.messageCount} email(s)</span>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {action.status === 'failed' && action.errorMessage && (
                  <div className="text-sm text-red-600 mt-1">
                    Error: {action.errorMessage}
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-muted-foreground mt-2">
                  {formatDistance(new Date(action.createdAt), new Date(), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
