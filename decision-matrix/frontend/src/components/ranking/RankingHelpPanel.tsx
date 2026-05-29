type Props = {
  algorithm: 'topsis' | 'wsm' | string;
};

export function RankingHelpPanel({ algorithm }: Props) {
  const activeAlgo = algorithm === 'wsm' ? 'wsm' : 'topsis';

  return (
    <details className="ranking-help card">
      <summary className="ranking-help__summary">Как пользоваться ранжированием</summary>
      <div className="ranking-help__body">
        <section className="ranking-help__section">
          <h3 className="ranking-help__heading">Порядок работы</h3>
          <ol className="ranking-help__steps">
            <li>
              Выберите <strong>точку интереса</strong> в шапке — её <strong>веса и алгоритм</strong>{' '}
              используются при сравнении всех POI проекта на вкладке «Результаты».
            </li>
            <li>
              Для каждой POI запустите <strong>анализ окружения</strong> (вкладка «Критерии» или карта).
              POI без анализа в общий рейтинг не попадают.
            </li>
            <li>
              На вкладке <strong>«Критерии»</strong> задайте <strong>веса</strong> (кнопка «Настроить
              веса…») или рассчитайте их через <strong>AHP</strong>. Сумма весов должна быть 1,000.
            </li>
            <li>
              При необходимости укажите <strong>экспертные оценки</strong> по каждому сценарию (риск,
              время, надёжность) и дефолты для пустых ячеек — через кнопки «Изменить…».
            </li>
            <li>
              Выберите алгоритм <strong>TOPSIS</strong> или <strong>WSM</strong> и нажмите{' '}
              <strong>«Рассчитать»</strong>.
            </li>
            <li>
              На вкладке <strong>«Результаты»</strong> — <strong>рейтинг всех POI</strong> проекта
              (базовый сценарий каждой точки), графики и карта; на{' '}
              <strong>«Чувствительность»</strong> — анализ сценариев выбранной POI.
            </li>
          </ol>
        </section>

        <section className="ranking-help__section">
          <h3 className="ranking-help__heading">Критерии</h3>
          <ul className="ranking-help__list">
            <li>
              <strong>Вычисляемые</strong> (стоимость, расстояние, превышения) — берутся из анализа
              сценария автоматически.
            </li>
            <li>
              <strong>Экспертные</strong> (риск, время, надёжность) — задаются вручную по каждому
              сценарию; если не заполнены, используются дефолты (риск 5, надёжность 5, время 12 мес.).
            </li>
            <li>
              Критерии типа <em>минимизация</em> — чем меньше значение, тем лучше;{' '}
              <em>максимизация</em> (надёжность) — чем больше, тем лучше.
            </li>
          </ul>
        </section>

        <section className="ranking-help__section">
          <h3 className="ranking-help__heading">TOPSIS и WSM — в чём разница</h3>
          <div className="ranking-help__algo-grid">
            <div className={`ranking-help__algo${activeAlgo === 'topsis' ? ' ranking-help__algo--active' : ''}`}>
              <h4 className="ranking-help__algo-title">TOPSIS</h4>
              <p className="ranking-help__algo-lead">
                Technique for Order Preference by Similarity to Ideal Solution — метод близости к
                идеальному решению.
              </p>
              <ul className="ranking-help__list">
                <li>Нормализует все критерии и строит <strong>идеальный</strong> и{' '}
                  <strong>анти-идеальный</strong> сценарий.</li>
                <li>
                  Оценивает, насколько каждый вариант близок к лучшему и далёк от худшего по всем
                  критериям сразу.
                </li>
                <li>
                  Лучше отражает <strong>компромисс</strong> между критериями; один сильный минус
                  может сильнее снизить место в рейтинге.
                </li>
                <li>Используется <strong>по умолчанию</strong>.</li>
              </ul>
            </div>
            <div className={`ranking-help__algo${activeAlgo === 'wsm' ? ' ranking-help__algo--active' : ''}`}>
              <h4 className="ranking-help__algo-title">WSM</h4>
              <p className="ranking-help__algo-lead">
                Weighted Sum Model — взвешенная сумма нормализованных показателей.
              </p>
              <ul className="ranking-help__list">
                <li>Складывает нормализованные значения критериев, умноженные на веса.</li>
                <li>
                  Проще интерпретировать: итоговый балл — прямая «средневзвешенная» оценка по
                  шкале 0–1.
                </li>
                <li>
                  Может <strong>компенсировать</strong> слабые стороны одного критерия сильными
                  результатами по другим.
                </li>
                <li>Удобен, когда важна простая линейная агрегация.</li>
              </ul>
            </div>
          </div>
          <p className="ranking-help__note">
            Оба метода используют одни и те же веса и матрицу критериев; отличается только формула
            итогового score. При сомнениях сравните результаты обоих алгоритмов и вкладку
            «Чувствительность».
          </p>
        </section>
      </div>
    </details>
  );
}
