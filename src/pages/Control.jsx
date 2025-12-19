import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import moment from 'moment';
import { RefreshCw } from 'lucide-react';

import usePostRequest from '@/hooks/usePostRequest';
import Timer from '@/worker/Timer';
import SimpleTimeSeriesGraph from '@/components/ui/simple-time-series-graph';

/**
 * 지구대기물질 관제 페이지
 * @returns {React.ReactNode} 지구대기물질 관제 페이지
 */
function Control() {
  const postMutation = usePostRequest();

  // url 관련
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const sitecdParam = queryParams.get('sitecd');

  const [siteList, setSiteList] = useState([]);
  const [selectedSite, setSelectedSite] = useState({});

  const [data, setData] = useState([]);

  const [defaultSeconds, setDefaultSeconds] = useState(300);
  const [clickedTime, setClickedTime] = useState(moment());

  const [openedItemCd, setOpenedItemCd] = useState(null);
  const [graphData, setGraphData] = useState(null);

  const scrollPosition = useRef(0);

  const worker = new Worker(
    new URL('../worker/timerWorker.js', import.meta.url),
    { type: 'module' }
  );

  /* 측정소 목록 조회 */
  const getSiteList = async () => {
    const siteData = await postMutation.mutateAsync({
      url: '/caqis/srch/datas.do',
      data: { page: 'caq/site', sitecd: '422001' }, // sitecd 'all'로 하면 전체 조회
    });

    setSiteList(siteData.rstList);
  };

  /* 컴포넌트 마운트 시 측정소 목록 조회 */
  useEffect(() => {
    getSiteList();
  }, []);

  /* 측정소 목록 조회 후 관제 데이터 조회 */
  useEffect(() => {
    if (siteList.length > 0) {
      const targetSite =
        siteList.find(site => site.sitecd === Number(sitecdParam)) ||
        siteList[0];

      setSelectedSite(targetSite);
      getControlData(targetSite.sitecd);

      if (!sitecdParam) {
        navigate(`?sitecd=${targetSite.sitecd}`, { replace: true });
      }
    }

    worker.postMessage(300000);
  }, [siteList]);

  /* 관제 데이터 조회 후 그래프 데이터 조회 */
  useEffect(() => {
    if (data.length === 0) return;
    getGraphData(
      selectedSite.sitecd,
      openedItemCd ? openedItemCd : data[0]?.itemCd
    );
  }, [data]);

  /* 측정소 버튼 클릭 핸들러 */
  const handleClickSiteBtn = site => {
    setSelectedSite(site);
    getControlData(site.sitecd);

    navigate(`?sitecd=${site.sitecd}`, { replace: false });
  };

  /* 타이머 및 데이터 새로고침 */
  useEffect(() => {
    if (selectedSite.sitecd) {
      getControlData(selectedSite.sitecd);
    }
    worker.postMessage(300000);

    return () => worker.terminate();
  }, [defaultSeconds, clickedTime]);

  worker.onmessage = () => {
    setDefaultSeconds(300);
    setClickedTime(moment());
  };

  /* 측정소별 관제 데이터 조회 */
  const getControlData = async sitecd => {
    scrollPosition.current = window.scrollY;

    const dataRes = await postMutation.mutateAsync({
      url: '/caqis/srch/datas.do',
      data: { page: 'caq/selectlastdata1', sitecd: sitecd },
    });

    // console.log('control data');
    // console.log(dataRes.rstList2);
    setData(dataRes.rstList2);
  };

  /* 그래프 데이터 가져오는 함수 */
  const getGraphData = async (sitecd, itemcd) => {
    const dataRes = await postMutation.mutateAsync({
      url: '/caqis/srch/datas.do',
      data: { page: 'caq/selectlast72hour', sitecd: sitecd, itemcd: itemcd },
    });

    if (dataRes.rstList[0] === 'NO DATA') {
      alert('그래프를 그릴 데이터가 없습니다.');
      return;
    }

    // console.log('graphdata: ');
    // console.log(dataRes.rstList);
    setGraphData(dataRes.rstList);
  };

  /* 카드 헤더 클릭 핸들러 */
  const handleClickCardHead = async itemCd => {
    setOpenedItemCd(itemCd);
    await getGraphData(selectedSite.sitecd, itemCd);
  };

  /* 새로고침 클릭 핸들러 */
  const handleClickRefresh = () => {
    console.log('clicked refresh button');
    setDefaultSeconds(300);
    setClickedTime(moment());
  };

  /* 2시간 초과 여부 판단 */
  const isOverTwoHours = mdatetime => {
    const mdatetimeMoment = moment(mdatetime);
    const diff = moment().diff(mdatetimeMoment, 'hours');
    return diff >= 2;
  };

  return (
    <>
      <div className="site-btns-container">
        {siteList?.map(site => (
          <button
            key={site.sitecd}
            value={site.sitecd}
            className={`site-btn ${
              selectedSite?.sitecd === site.sitecd ? 'active' : ''
            }`}
            onClick={() => handleClickSiteBtn(site)}
          >
            {site.site.slice(0, 3)}
          </button>
        ))}
      </div>

      {/* 헤더 */}
      <header className="aq-header">
        <div className="aq-title">
          {selectedSite.site
            ? `${selectedSite.site.slice(0, 3)} 지구대기물질 관제`
            : '지구대기물질 관제'}
        </div>
        <div className="aq-time">
          update{'  '}
          <span id="aq-time">
            <Timer defaultSeconds={defaultSeconds} clickedTime={clickedTime} />
          </span>
          {'  '}
          <RefreshCw
            width={16}
            height={16}
            style={{ cursor: 'pointer' }}
            onClick={handleClickRefresh}
          />
        </div>
      </header>

      {/* 시계열 그래프 */}
      {graphData && graphData.length !== 0 && (
        <section className="graph-section">
          <SimpleTimeSeriesGraph data={graphData} />
        </section>
      )}

      {/* 메인 카드 */}
      <main className="aq-grid" id="grid">
        {data?.map((d, idx) => {
          return (
            <article key={`${d.itemNm}-${idx}`} className="aq-card">
              <div
                className="aq-card__head"
                onClick={() => handleClickCardHead(d.itemCd)}
              >
                <span>{`${d.itemNm}`}</span>
              </div>
              <div
                className="aq-card__date"
                style={{
                  color: isOverTwoHours(d.mdatetime) ? 'red' : 'inherit',
                }}
              >
                {d.mdatetime}
              </div>
              <div className="aq-card__value">
                {d.conc} <span className="aq-card__unit">{d.itemUnit}</span>
              </div>
            </article>
          );
        })}
      </main>
    </>
  );
}

export default Control;
