import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key } from 'lucide-react';

interface TokenScreenProps {
  onSubmit: (token: string) => void;
}

export function TokenScreen({ onSubmit }: TokenScreenProps) {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) onSubmit(token.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Connect to Linear</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your Linear API key to get started. You can create one in Linear → Settings → API.
          </p>
        </div>
        <Input
          type="password"
          placeholder="lin_api_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="bg-secondary border-border"
        />
        <Button type="submit" className="w-full" disabled={!token.trim()}>
          Connect
        </Button>
      </form>
    </div>
  );
}
