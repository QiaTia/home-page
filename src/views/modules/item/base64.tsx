import Button from '@/components/Button';
import { InboxOutlined } from '@ant-design/icons'
import { useState } from "preact/hooks";
import Spin from "@/components/Spin";
import notify from "@/utils/notify";


function getBase64(file: any): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  })
}

export default () => {
  const [ defaultValue, setValue ] = useState<string>('')
  const [ loading, setLoad ] = useState<boolean>(false)

  const props = {
    customRequest({ onSuccess, onError, file }: any) {
      setLoad(true)
      getBase64(file).then((e) => {
        setValue(e as string)
        setLoad(false)
        onSuccess(e)
      }).catch(onError)
    },
    maxCount: 1,
    itemRender: () => <li></li>
  }
  const handleCopy = () => {
    const temp = defaultValue
    // @ts-ignore
    if (window.clipboardData){
      // @ts-ignore
      window.clipboardData.clearData();
      // @ts-ignore
      clipboardData.setData("Text", temp);
      notify.success("已复制内容到剪辑版!")
    }else if(document.execCommand('copy')){
      const oInput = document.createElement('input');
      oInput.value = temp;
      document.body.appendChild(oInput);
      // oInput.style.display='none'
      oInput.select(); // 选择对象
      document.execCommand("Copy"); // 执行浏览器复制命令
      oInput.remove();
      notify.success("已复制内容到剪辑版!")
    }else{
      notify.error(`复制失败, 请手动复制!`)
    }
  }
  const handleInput = (e:any) => {
    setValue(e.target.value)
    // console.log(e.target.value)
  }
  const handleBase64 = () => {
    try{
      const val = window.btoa(defaultValue)
      setValue(val)
    }catch {
      notify.error(`解析失败, 请检查你输入的内容!`)
    }
  }
  const handleToString = () => {
    try{
      const val = window.atob(defaultValue)
      setValue(val)
    }catch {
      notify.error(`解析失败, 请检查你输入的内容!`)
    }
  }
  return <div className="container flex-algin flex-column" style={{ padding: "60px 0" }}>
    <Spin spinning={ loading } tip="Loading...">
      <Dragger style={{ padding: "0 20px" }} {...props}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag file to this area to base64</p>
      </Dragger>
    </Spin>
    <Spin spinning={ loading } tip="Loading...">
      <div style={{ backgroundColor: "#fff", borderRadius: "2px", marginTop: "60px", padding: "20px" }}>
        <textarea className="textarea" value={ defaultValue } onInput={ handleInput }
          placeholder="Input base64 code to string"
          autoSize={{ minRows: 4, maxRows: 10 }} />
        <div className="flex-between">
          <Button onClick = { handleCopy }>Copy Content</Button>
          <Button onClick = { handleBase64 }>To Base64</Button>
          <Button onClick = { handleToString }>To String</Button>
        </div>     
      </div>
    </Spin>

  </div>
}