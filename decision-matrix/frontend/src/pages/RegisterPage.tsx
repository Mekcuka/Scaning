import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../store';

const schema = z
  .object({
    email: z.string().email('Некорректный email'),
    username: z.string().min(2, 'Минимум 2 символа'),
    password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[A-Za-z]/, 'Нужна буква')
      .regex(/\d/, 'Нужна цифра'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const {
    control,
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
    <div
      className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto p-4"
      style={{ background: 'var(--bg)' }}
    >
      <Card className="w-full max-w-md">
        <Typography.Title level={3}>Регистрация</Typography.Title>
        <Typography.Paragraph type="secondary">
          Новые пользователи получают роль «Аналитик»
        </Typography.Paragraph>
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <Form layout="vertical" component="div" requiredMark={false}>
            <Form.Item
              label="Email"
              validateStatus={errors.email ? 'error' : undefined}
              help={errors.email?.message}
            >
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input {...field} type="email" className="auth-form__input" />
                )}
              />
            </Form.Item>
            <Form.Item
              label="Имя"
              validateStatus={errors.username ? 'error' : undefined}
              help={errors.username?.message}
            >
              <Controller
                name="username"
                control={control}
                render={({ field }) => <Input {...field} className="auth-form__input" />}
              />
            </Form.Item>
            <Form.Item
              label="Пароль"
              validateStatus={errors.password ? 'error' : undefined}
              help={errors.password?.message}
            >
              <Controller
                name="password"
                control={control}
                render={({ field }) => <Input.Password {...field} className="auth-form__input" />}
              />
            </Form.Item>
            <Form.Item
              label="Подтверждение пароля"
              validateStatus={errors.confirm ? 'error' : undefined}
              help={errors.confirm?.message}
            >
              <Controller
                name="confirm"
                control={control}
                render={({ field }) => <Input.Password {...field} className="auth-form__input" />}
              />
            </Form.Item>
          </Form>
          {errors.root?.message && (
            <Alert type="error" message={errors.root.message} className="mb-4" showIcon />
          )}
          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            {isSubmitting ? 'Регистрация…' : 'Зарегистрироваться'}
          </Button>
        </form>
        <Typography.Paragraph className="text-center mt-4 mb-0" type="secondary">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
