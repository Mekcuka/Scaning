import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../store';

const schema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'engineer@oilgas.ru', password: 'password123' },
  });

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/', { replace: true });
    }
  }, [isLoading, user, navigate]);

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Ошибка входа' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="card w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            С
          </div>
          <div>
            <h1 className="text-xl font-bold">СППР Нефтегаз</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Система поддержки принятия решений
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" {...register('email')} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input type="password" {...register('password')} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          {errors.root && <p className="text-red-500 text-sm mb-3">{errors.root.message}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <p className="text-sm mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Нет аккаунта?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Регистрация
          </Link>
        </p>
        <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Демо: engineer@oilgas.ru / password123
        </p>
      </div>
    </div>
  );
}
