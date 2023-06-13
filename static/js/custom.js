$(document).ready(function() {
  var chatBtn = $('#chatBtn');
  var chatInput = $('#chatInput');
  var chatWindow = $('#chatWindow');
  var ckey = $('#ckey');
  var sumbits = $('#sumbits');
  var messages = [];
  const renderer = new marked.Renderer();
  renderer.list = function(body, ordered, start) {
    const type = ordered ? 'ol' : 'ul';
    const startAttr = (ordered && start) ? ` start="${start}"` : '';
    return `<${type}${startAttr}>\n${body}</${type}>\n`;
  };
  marked.setOptions({
    renderer: renderer,
    highlight: function (code, language) {
      const validLanguage = hljs.getLanguage(language) ? language : 'javascript';
      return hljs.highlight(code, { language: validLanguage }).value;
    }
  });
  function escapeHtml(html) {
    let text = document.createTextNode(html);
    let div = document.createElement('div');
    div.appendChild(text);
    return div.innerHTML;
  }
  function addRequestMessage(message) {
    $(".answer .tips").css({"display":"none"});
    chatInput.val('');
    let escapedMessage = escapeHtml(message);
    let requestMessageElement = $('<div class="message-bubble"><span class="chat-icon request-icon"></span><div class="message-text request"><p>' +  escapedMessage + '</p></div></div>');
    chatWindow.append(requestMessageElement);
    let responseMessageElement = $('<div class="message-bubble"><span class="chat-icon response-icon"></span><div class="message-text response"><span class="loading-icon"><i class="fa fa-spinner fa-pulse fa-2x"></i></span></div></div>');
    chatWindow.append(responseMessageElement);
    chatWindow.scrollTop(chatWindow.prop('scrollHeight'));
  }
  function addResponseMessage(message) {
    let lastResponseElement = $(".message-bubble .response").last();
    lastResponseElement.empty();
    if ($(".answer .others .center").css("display") === "none") {
      $(".answer .others .center").css("display", "flex");
    }
    let escapedMessage;
    let codeMarkCount = 0;
    let index = message.indexOf('```');
    while (index !== -1) {
      codeMarkCount ++ ;
      index = message.indexOf('```', index + 3);
    }
    if(codeMarkCount % 2 == 1  ){
      escapedMessage = marked.parse(message + '\n\n```');
    }else if(codeMarkCount % 2 == 0 && codeMarkCount != 0){
      escapedMessage = marked.parse(message);
    }else if(codeMarkCount == 0){
      if (message.includes('`')){
        escapedMessage = marked.parse(message);
      }else{
        escapedMessage = marked.parse(escapeHtml(message));
      }
    }
    lastResponseElement.append(escapedMessage);
    chatWindow.scrollTop(chatWindow.prop('scrollHeight'));
  }

  function addFailMessage(message) {
    let lastResponseElement = $(".message-bubble .response").last();
    lastResponseElement.empty();
    lastResponseElement.append('<p class="error">' + message + '</p>');
    chatWindow.scrollTop(chatWindow.prop('scrollHeight'));
    messages.pop()
  }

  function yanZheng(data){
    ajaxRequest = $.ajax({
      url: '/yanzheng',
      method: 'POST',
      data: data,
      success:function(result){
        var jss = result;
        if(jss.code === "1"){
          localStorage.setItem("ckey","cktrue");
          $('#myModal').css('display','none');
        }else{
          $('#ckey').val("ckey错误");
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        addFailMessage('出错啦！请稍后再试!');
      }
    });
  }
  sumbits.click(function () {
    let ckey = $('#ckey').val();
    if(ckey===undefined || ckey === ''){
      alert("输入不能为空")
    }
    let data = {'ckey':ckey};
    yanZheng(data);
  });
  function initWindow(){
    var cnum = parseInt(localStorage.getItem("cnums"));
    var ckey = localStorage.getItem("ckey");
    if(ckey){
      let data = {'ckey':ckey};
      $.ajax({
        url: '/yanzheng',
        method: 'POST',
        data: data,
        success:function(result){
          var jss = result;
          if(jss.code === "1"){
            localStorage.setItem("ckey","cktrue");
          }else{
            if(cnum){
              if(cnum>4){
                $('#myModal').css('display','block');
              }
            }else{
              localStorage.setItem("cnums",0);
            }
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          addFailMessage('网络出错啦！');
        }
      });
    }else{
      if(cnum){
        if(cnum>4){
          $('#myModal').css('display','block');
        }
      }else{
        localStorage.setItem("cnums",0);
      }
    }

  }

  initWindow();
  let ajaxRequest = null;
  chatBtn.click(function() {

    chatInput.off("keydown",handleEnter);
    let data = {};
    data.model = $(".settings-common .model").val();
    let resFlag = true;
    let apiKey = localStorage.getItem('apiKey');
    if (apiKey){
      data.apiKey = apiKey;
    }
    let message = chatInput.val();
    if (message.length == 0){
      chatInput.on("keydown",handleEnter);
      return ;
    }

    addRequestMessage(message);
    messages.push({"role": "user", "content": message})
    chatBtn.attr('disabled',true);
    if(messages.length>40){
      addFailMessage("此次对话长度过长，请点击下方删除按钮清除对话内容！");
      chatInput.on("keydown",handleEnter);
      chatBtn.attr('disabled',false);
      return ;
    }

    data.prompts = messages.slice();
    if(localStorage.getItem('continuousDialogue') == 'true'){
      if(data.prompts.length > 8) {
        data.prompts.splice(0, data.prompts.length - 7);
      }
    }else{
      data.prompts.splice(0, data.prompts.length - 1);
    }
    data.prompts = JSON.stringify(data.prompts);

    let res;
    ajaxRequest = $.ajax({
      url: '/chat',
      method: 'POST',
      data: data,
      xhrFields: {
        onprogress: function(e) {
          res = e.target.responseText;
          let resJsonObj;
          try{
            resJsonObj = JSON.parse(res);
            if(resJsonObj.hasOwnProperty("error")){
              addFailMessage(resJsonObj.error.type + " : " + resJsonObj.error.message + " " + resJsonObj.error.code);
              resFlag = false;
            }else{
              addResponseMessage(res);
            }
          }catch(e){
            addResponseMessage(res);
          }
        }
      },
      success:function(result){
        if(resFlag){
          messages.push({"role": "assistant", "content": result});
          if(localStorage.getItem('archiveSession')=="true"){
            localStorage.setItem("session",JSON.stringify(messages));
          }
        }
        if(localStorage.getItem("ckey") ==="cktrue"){
        }else{
          var cnum = parseInt(localStorage.getItem("cnums"));
          if(cnum){
            if(cnum>4){
              $('#myModal').css('display','block');
            }else{
              cnum = cnum+1;localStorage.setItem("cnums",cnum);
            }

          }else{localStorage.setItem("cnums",1);}
        }

      },
      error: function(jqXHR, textStatus, errorThrown) {
        if (textStatus === 'abort') {
          messages.push({"role": "assistant", "content": res});
          if(localStorage.getItem('archiveSession')=="true"){
            localStorage.setItem("session",JSON.stringify(messages));
          }
        } else {
          addFailMessage('出错啦！请稍后再试!');
        }
      },
      complete : function(XMLHttpRequest,status){
        chatBtn.attr('disabled',false)
        chatInput.on("keydown",handleEnter);
        ajaxRequest = null;
        $(".answer .others .center").css("display","none");
        copy();
      }
    });
  });

  $('.stop a').click(function() {
    if(ajaxRequest){
      ajaxRequest.abort();
    }
  })

  function handleEnter(e){
    if (e.keyCode==13){
      chatBtn.click();
      e.preventDefault();
    }
  }

  chatInput.on("keydown",handleEnter);

  let width = $('.function .others').width();
  $('.function .settings .dropdown-menu').css('width', width);

  $(window).resize(function() {
    width = $('.function .others').width();
    $('.function .settings .dropdown-menu').css('width', width);
  });

  function setBgColor(theme){
    $(':root').attr('bg-theme', theme);
    $('.settings-common .theme').val(theme);
    $('.settings-common').css('background-color', 'var(--bg-color)');
  }

  let theme = localStorage.getItem('theme');
  if (theme) {
    setBgColor(theme);
  }else{
    localStorage.setItem('theme', "light");
    theme = localStorage.getItem('theme');
    setBgColor(theme);
  }

  $('.settings-common .theme').change(function() {
    const selectedTheme = $(this).val();
    localStorage.setItem('theme', selectedTheme);
    $(':root').attr('bg-theme', selectedTheme);
    $('.settings-common').css('background-color', 'var(--bg-color)');
  });

  const apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    $(".settings-common .api-key").val(apiKey);
  }

  $(".settings-common .api-key").blur(function() {
    const apiKey = $(this).val();
    if(apiKey.length!=0){
      localStorage.setItem('apiKey', apiKey);
    }else{
      localStorage.removeItem('apiKey');
    }
  })

  var archiveSession = localStorage.getItem('archiveSession');
  if(archiveSession == null){
    archiveSession = "false";
    localStorage.setItem('archiveSession', archiveSession);
  }

  if(archiveSession == "true"){
    $("#chck-1").prop("checked", true);
  }else{
    $("#chck-1").prop("checked", false);
  }

  $('#chck-1').click(function() {
    if ($(this).prop('checked')) {
      localStorage.setItem('archiveSession', true);
      if(messages.length != 0){
        localStorage.setItem("session",JSON.stringify(messages));
      }
    } else {
      localStorage.setItem('archiveSession', false);
      localStorage.removeItem("session");
    }
  });
  if(archiveSession == "true"){
    const messagesList = JSON.parse(localStorage.getItem("session"));
    if(messagesList){
      messages = messagesList;
      $.each(messages, function(index, item) {
        if (item.role === 'user') {
          addRequestMessage(item.content)
        } else if (item.role === 'assistant') {
          addResponseMessage(item.content)
        }
      });
      $(".answer .others .center").css("display", "none");
      copy();
    }
  }
  var continuousDialogue = localStorage.getItem('continuousDialogue');
  if(continuousDialogue == null){
    continuousDialogue = "true";
    localStorage.setItem('continuousDialogue', continuousDialogue);
  }

  if(continuousDialogue == "true"){
    $("#chck-2").prop("checked", true);
  }else{
    $("#chck-2").prop("checked", false);
  }

  $('#chck-2').click(function() {
    if ($(this).prop('checked')) {
      localStorage.setItem('continuousDialogue', true);
    } else {
      localStorage.setItem('continuousDialogue', false);
    }
  });
  $(".delete a").click(function(){
    chatWindow.empty();
    $(".answer .tips").css({"display":"flex"});
    messages = [];
    localStorage.removeItem("session");
  });
  $(".screenshot a").click(function() {
    const clonedChatWindow = chatWindow.clone();
    clonedChatWindow.css({
      position: "absolute",
      left: "-9999px",
      overflow: "visible",
      width: chatWindow.width(),
      height: "auto"
    });
    $("body").append(clonedChatWindow);
    html2canvas(clonedChatWindow[0], {
      allowTaint: false,
      useCORS: true,
      scrollY: 0,
    }).then(function(canvas) {
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = "screenshot_" + Math.floor(Date.now() / 1000) + ".png";
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      clonedChatWindow.remove();
    });
  });
  function copy(){
    $('pre').each(function() {
      let btn = $('<button class="copy-btn">复制</button>');
      $(this).append(btn);
      btn.hide();
    });

    $('pre').hover(
        function() {
          $(this).find('.copy-btn').show();
        },
        function() {
          $(this).find('.copy-btn').hide();
        }
    );

    $('pre').on('click', '.copy-btn', function() {
      let text = $(this).siblings('code').text();
      let textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        $(this).text('复制成功');
      } catch (e) {
        $(this).text('复制失败');
      }
      document.body.removeChild(textArea);
      setTimeout(() => {
        $(this).text('复制');
      }, 2000);
    });
  }
});
