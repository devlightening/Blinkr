namespace Blinkr.Mobile.Pages;

public partial class NotificationsPage : ContentPage
{
    public NotificationsPage()
    {
        InitializeComponent();
        NotifList.ItemsSource = new[]
        {
            new { Title="Kullanıcı Adı gönderini beğendi.", Body="", Ago="2s" },
            new { Title="Yeni bir yorum var", Body="Harika!", Ago="5s" }
        };
    }
}

