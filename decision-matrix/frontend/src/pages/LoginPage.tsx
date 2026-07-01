import { zodResolver } from '@hookform/resolvers/zod';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Spin, Typography } from 'antd';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { APP_LOGO_MARK, APP_NAME, APP_TAGLINE } from '../lib/branding';
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
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
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
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Spin aria-label="Загрузка" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 min-h-0 items-center justify-center overflow-y-auto p-4"
      style={{ background: 'var(--bg)' }}
    >
      <Card className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            {APP_LOGO_MARK}
          </div>
          <div>
            <Typography.Title level={3} className="!mb-0">
              {APP_NAME}
            </Typography.Title>
            <Typography.Text type="secondary">{APP_TAGLINE}</Typography.Text>
          </div>
        </div>
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
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    id="login-email"
                    aria-label="Email"
                    className="auth-form__input"
                  />
                )}
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
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    autoComplete="current-password"
                    id="login-password"
                    aria-label="Пароль"
                    className="auth-form__input"
                    iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  />
                )}
              />
            </Form.Item>
          </Form>
          {errors.root?.message && (
            <Alert type="error" message={errors.root.message} className="mb-4" showIcon />
          )}
          <Button type="primary" htmlType="submit" block loading={isSubmitting}>
            {isSubmitting ? 'Вход…' : 'Войти'}
          </Button>
        </form>
        <Typography.Paragraph className="text-center mt-4 mb-0" type="secondary">
          Нет аккаунта?{' '}
          <Link to="/register">Регистрация</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
