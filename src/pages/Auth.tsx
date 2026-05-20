import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import vecturaLogo from '@/assets/vectura-logo.png';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, resetPassword, updatePassword, isPasswordRecovery } = useAuth();
  const { toast } = useToast();

  // Redirect if already authenticated
  if (user && !isPasswordRecovery) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });
    }
    
    setLoading(false);
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await resetPassword(resetEmail || email);

    if (error) {
      toast({
        title: "No se pudo enviar el email",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email enviado",
        description: "Revisa tu correo para crear una nueva contraseña.",
      });
      setIsForgotPassword(false);
    }

    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Revisa ambos campos antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await updatePassword(newPassword);

    if (error) {
      toast({
        title: "No se pudo actualizar la contraseña",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Contraseña actualizada",
        description: "Ya puedes acceder con tu nueva contraseña.",
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signUp(email, password);
    
    if (error) {
      toast({
        title: "Error al registrarse",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Registro exitoso!",
        description: "Tu cuenta ha quedado activa y ya puedes iniciar sesión.",
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-6">
          <div className="flex justify-center">
            <img 
              src={vecturaLogo} 
              alt="Vectorea" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl">Vectorea</CardTitle>
            <CardDescription>
              Gestión de proyectos e incidencias colaborativa
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isPasswordRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </Button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleResetPasswordRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="tu.email@ejemplo.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar email de recuperación'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                disabled={loading}
                onClick={() => setIsForgotPassword(false)}
              >
                Volver al login
              </Button>
            </form>
          ) : (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Contraseña</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setResetEmail(email);
                    setIsForgotPassword(true);
                  }}
                >
                  He olvidado la contraseña
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Registrándose...' : 'Registrarse'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
