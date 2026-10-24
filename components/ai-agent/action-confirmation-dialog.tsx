'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AISuggestion } from './email-analyzer';

interface ActionConfirmationDialogProps {
  open: boolean;
  suggestion: AISuggestion;
  onClose: () => void;
  onConfirm?: (approved: boolean) => void;
}

export default function ActionConfirmationDialog({
  open,
  suggestion,
  onClose,
  onConfirm,
}: ActionConfirmationDialogProps) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: suggestion.suggestionId,
          approved: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to execute action');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to execute action',
        });
        return;
      }

      toast({
        title: 'Action exécutée',
        description: 'Tes mails ont été mis à jour.',
      });

      onConfirm?.(true);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to execute action');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to execute action',
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: suggestion.suggestionId,
          approved: false,
        }),
      });

      onConfirm?.(false);
      onClose();
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      onClose();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Confirm Action
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please review the action before proceeding. This will be applied to your Gmail account.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Suggestion Details */}
        <div className="bg-muted p-4 rounded-lg space-y-2 my-4">
          <p className="font-medium">{suggestion.humanReadable}</p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">View technical details</summary>
            <pre className="mt-2 overflow-auto bg-background p-2 rounded text-xs">
              {JSON.stringify(
                {
                  tool: suggestion.tool,
                  params: suggestion.params,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Warning */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> This action will be applied to your Gmail account immediately. Make sure you want to proceed.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-3">
          <AlertDialogCancel onClick={handleCancel} disabled={executing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={executing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {executing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              'Confirm & Execute'
            )}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
