import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../store';

const schema = z.object({
  email: z.string().email('Некорректный email'),
  username: z.string().min(2, 'Минимум 2 символа'),
  password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .regex(/[A-Za-z]/, 'Нужна буква')
    .regex(/\d/, 'Нужна цифра'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Пароли не совпадают',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(data.email, data.password, data.username);
      navigate('/');
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Ошибка регистрации' });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="card w-full max-w-md mx-4">
        <h1 className="text-xl font-bold mb-2">Регистрация</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Новые пользователи получают роль «Аналитик»
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="form-group">
            <label>Email</label>
            <input type="email" {...register('email')} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="form-group">
            <label>Имя</label>
            <input type="text" {...register('username')} />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input type="password" {...register('password')} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="form-group">
            <label>Подтверждение пароля</label>
            <input type="password" {...register('confirm')} />
            {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
          </div>
          {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>
        <p className="text-sm mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
