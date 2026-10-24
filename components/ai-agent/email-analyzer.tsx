'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ActionConfirmationDialog from './action-confirmation-dialog';

export interface AISuggestion {
  suggestionId: string;
  tool: string;
  params: Record<string, any>;
  humanReadable: string;
}

export default function EmailAnalyzer() {
  const { toast } = useToast();
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(true);

  /**
   * Submit analysis request to AI
   */
  const handleAnalyze = async () => {
    if (!request.trim()) {
      setError('Please enter your email request');
      return;
    }

    setError(null);
    setLoading(true);
    setSuggestion(null);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error?.includes('Gmail')) {
          setGmailConnected(false);
          setError('Gmail not connected. Please authorize Gmail access first.');
        } else {
          setError(data.error || 'Failed to analyze request');
        }
        return;
      }

      setSuggestion(data);
      setShowConfirmDialog(true);
      toast({
        title: 'Suggestion prête',
        description: "Vérifie l'action proposée et confirme-la si elle te convient.",
      });
    } catch (err: any) {
      setError(err.message || 'Failed to analyze request');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to analyze request',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Connect Gmail account
   */
  const handleConnectGmail = () => {
    window.location.href = '/api/gmail/connect';
  };

  /**
   * Handle dialog close
   */
  const handleDialogClose = () => {
    setShowConfirmDialog(false);
    setSuggestion(null);
    setRequest('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Gmail Connection Alert */}
      {!gmailConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <div className="flex items-center justify-between">
              <span>Gmail is not connected. You need to authorize access to use the AI assistant.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectGmail}
                className="ml-4"
              >
                Connect Gmail
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle>Email AI Assistant</CardTitle>
          <CardDescription>
            Tell me what you want to do with your emails and I'll suggest an action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Request Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What would you like to do?</label>
            <Input
              placeholder="e.g., 'Organize my important emails' or 'Label work-related messages'"
              value={request}
              onChange={(e) => {
                setRequest(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleAnalyze();
                }
              }}
              disabled={loading || !gmailConnected}
              className="min-h-12"
            />
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Request Examples */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Example requests:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• "Label all unread emails from my boss"</li>
              <li>• "Archive emails older than 3 months"</li>
              <li>• "Find important work-related messages"</li>
            </ul>
          </div>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={loading || !gmailConnected}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Analyze'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Suggestion Card (shown when AI returns suggestion) */}
      {suggestion && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              AI Suggestion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-card p-4 rounded-lg border">
              <p className="text-lg font-medium">{suggestion.humanReadable}</p>
              <p className="text-sm text-muted-foreground mt-2">Tool: {suggestion.tool}</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setSuggestion(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => setShowConfirmDialog(true)}
              >
                Confirm & Execute
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {suggestion && (
        <ActionConfirmationDialog
          open={showConfirmDialog}
          suggestion={suggestion}
          onClose={handleDialogClose}
          onConfirm={(approved) => {
            if (approved) {
              toast({
                title: 'Action exécutée',
                description: 'Tes mails ont été mis à jour.',
              });
            }
          }}
        />
      )}
    </div>
  );
}
